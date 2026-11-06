import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

app.registerExtension({
  name: "comfyui-media-library.path",
  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name !== "MediaLibraryPath") return;
    const previous = nodeType.prototype.onNodeCreated;
    nodeType.prototype.onNodeCreated = function () {
      previous?.apply(this, arguments);
      const node = this;
      const path = node.widgets.find(w => w.name === "file_path");
      const id = node.widgets.find(w => w.name === "asset_id");
      if (!path || !id) return;
      path.label = "原文件完整路径";
      // Persist the stable ID without exposing an implementation field in the node UI.
      id.hidden = true;
      id.type = "media_library_internal";
      id.computeSize = () => [0, -4];
      let dialog, frame, previewRequest = 0, selectionRequest = 0, statusTimer, disposed = false;
      const control = document.createElement("div");
      control.style.cssText = "width:100%;height:42px;display:flex;align-items:center";
      const browse = document.createElement("button");
      browse.textContent = "▦ 浏览素材库 · 搜索 / 预览 / 管理";
      const browseLabel = browse.textContent;
      browse.title = "选中节点后可直接粘贴图片，自动上传到 input/pasted";
      browse.style.cssText = "width:100%;height:35px;border:1px solid #566982;border-radius:7px;background:#27344a;color:#d9e6fb;cursor:pointer";
      control.append(browse);
      const preview = document.createElement("iframe");
      preview.title = "所选素材预览";
      preview.style.cssText = "width:100%;height:100%;min-height:280px;border:0;border-radius:7px;background:#161a21";
      const update = async () => {
        const request = ++previewRequest;
        let query = new URLSearchParams({mode:"preview",id:String(id.value || ""),path:String(path.value || "")});
        preview.src = api.apiURL("/media_library/gallery?" + query);
        if (!id.value && !path.value) return;
        try {
          const response = await fetch(api.apiURL("/media_library/detail?" + new URLSearchParams({id:String(id.value||""),path:String(path.value||"")})));
          if (!response.ok) return;
          const item = await response.json();
          if (disposed || request !== previewRequest) return;
          path.value = item.path; id.value = item.id;
          node.setDirtyCanvas(true, true);
        } catch { /* The preview iframe displays the read error. */ }
      };
      // ComfyUI uses previewMediaType to route clipboard images to the selected node.
      node.previewMediaType = "image";
      node.pasteFiles = async files => {
        const file = Array.from(files).find(file => file?.type?.startsWith("image/"));
        if (!file || disposed || node.isUploading) return;
        const request = ++selectionRequest;
        node.isUploading = true;
        clearTimeout(statusTimer);
        browse.textContent = "正在上传粘贴图片…";
        try {
          const rootsResponse = await fetch(api.apiURL("/media_library/roots"));
          if (!rootsResponse.ok) throw new Error("无法读取 input 目录");
          const roots = await rootsResponse.json();
          const root = roots.roots.find(root => root.id === "builtin-input");
          if (!root) throw new Error("找不到 ComfyUI input 目录");
          const form = new FormData();
          form.append("image", file, file.name || "pasted-image.png");
          form.append("type", "input");
          form.append("subfolder", "pasted");
          const response = await fetch(api.apiURL("/upload/image"), {method:"POST",body:form});
          if (!response.ok) throw new Error(response.status === 413 ? "图片超过 ComfyUI 上传大小限制" : `上传失败（${response.status}）`);
          const uploaded = await response.json();
          if (!uploaded.name) throw new Error("上传接口未返回文件名");
          const separator = root.path.includes("\\") ? "\\" : "/";
          const uploadedPath = [root.path.replace(/[\\/]$/, ""), ...(uploaded.subfolder || "").split(/[\\/]/).filter(Boolean), uploaded.name].join(separator);
          const detailResponse = await fetch(api.apiURL("/media_library/detail?" + new URLSearchParams({path:uploadedPath})));
          const item = await detailResponse.json();
          if (!detailResponse.ok) throw new Error(item.error || "图片已上传，但读取信息失败");
          if (disposed || request !== selectionRequest) return;
          id.value = item.id; path.value = item.path;
          app.graph.change(); node.setDirtyCanvas(true, true); void update();
          browse.textContent = browseLabel;
        } catch (error) {
          if (!disposed) {
            browse.textContent = `粘贴失败：${error.message}`;
            statusTimer = setTimeout(() => { if (!disposed) browse.textContent = browseLabel; }, 6000);
          }
        } finally {
          node.isUploading = false;
          if (!disposed && request !== selectionRequest) browse.textContent = browseLabel;
        }
      };
      const receivePaste = event => {
        if (event.origin !== location.origin || event.source !== preview.contentWindow || event.data?.type !== "media-library-paste-image") return;
        if (event.data.file instanceof File && event.data.file.type.startsWith("image/")) void node.pasteFiles([event.data.file]);
      };
      window.addEventListener("message", receivePaste);
      const callback = path.callback;
      path.callback = function () {++selectionRequest;callback?.apply(this, arguments);id.value="";app.graph.change();void update();};
      const close = () => {window.removeEventListener("message", receive);if(frame)frame.src="about:blank";dialog?.remove();dialog=null;frame=null;};
      const receive = event => {
        if (event.origin !== location.origin || event.source !== frame?.contentWindow) return;
        if (event.data?.type === "media-library-ready") {
          frame.contentWindow.postMessage({type:"media-library-current",id:id.value,path:path.value},location.origin);
        }
        if (event.data?.type === "media-library-changed") {void update();return;}
        if (event.data?.type !== "media-library-select" || typeof event.data.id !== "string" || typeof event.data.path !== "string") return;
        ++selectionRequest;id.value=event.data.id;path.value=event.data.path;
        app.graph.change();node.setDirtyCanvas(true,true);void update();close();
      };
      browse.onclick = () => {
        if(dialog)return;
        dialog=document.createElement("dialog");
        dialog.style.cssText="width:96vw;height:94vh;max-width:1900px;max-height:96vh;padding:0;border:1px solid #54627a;border-radius:12px;background:#191c22;color:#dce5f4";
        const header=document.createElement("div");header.style.cssText="height:40px;display:flex;align-items:center;justify-content:space-between;padding:0 16px";
        const label=document.createElement("span");label.textContent="素材库 · 选中文件后点击使用";
        const done=document.createElement("button");done.textContent="关闭";done.style.cssText="cursor:pointer;color:inherit;background:#2b3547;border:0;border-radius:5px;padding:5px 14px";done.onclick=close;
        header.append(label,done);
        frame=document.createElement("iframe");frame.title="素材库";frame.src=api.apiURL("/media_library/gallery?"+new URLSearchParams({current_id:String(id.value||""),current_path:String(path.value||"")}));frame.style.cssText="width:100%;height:calc(100% - 40px);border:0";
        dialog.append(header,frame);document.body.append(dialog);window.addEventListener("message",receive);
        dialog.addEventListener("cancel",event=>{event.preventDefault();close();});dialog.showModal();
      };
      node.addDOMWidget("media_library_browser","media_library_control",control,{serialize:false,hideOnZoom:false,getMinHeight:()=>42,getMaxHeight:()=>42});
      node.addDOMWidget("media_library_preview","media_library_preview",preview,{serialize:false,hideOnZoom:false,getMinHeight:()=>280,getMaxHeight:()=>430});
      const configure=node.onConfigure;
      node.onConfigure=function(){++selectionRequest;configure?.apply(this,arguments);void update();};
      const filesChanged = () => { if (!disposed) void update(); };
      api.addEventListener?.('media-library-changed', filesChanged);
      const removed=node.onRemoved;
      node.onRemoved=function(){api.removeEventListener?.('media-library-changed', filesChanged);window.removeEventListener("message",receivePaste);clearTimeout(statusTimer);disposed=true;++previewRequest;++selectionRequest;close();preview.src="about:blank";removed?.apply(this,arguments);};
      node.setSize([390,420]);void update();
    };
  },
});
