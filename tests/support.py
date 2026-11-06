from pathlib import Path
import importlib
import sys
import types

ROOT = Path(__file__).resolve().parents[1]
NAME = 'media_library_under_test'
if NAME not in sys.modules:
    package = types.ModuleType(NAME)
    package.__path__ = [str(ROOT)]
    sys.modules[NAME] = package
Library = importlib.import_module(NAME + '.library').Library
LibraryError = importlib.import_module(NAME + '.library').LibraryError
metadata = importlib.import_module(NAME + '.metadata')
register_routes = importlib.import_module(NAME + '.routes').register_routes
