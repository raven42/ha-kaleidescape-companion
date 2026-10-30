"""Register the authenticated household panel; never serve storage statically."""

import hashlib
from pathlib import Path

from homeassistant.components import frontend, panel_custom
from homeassistant.components.http import StaticPathConfig
from homeassistant.core import HomeAssistant, callback

from ..const import DOMAIN, NAME

PANEL_PATH = "kaleidescape-companion"
ASSET_URL = f"/{DOMAIN}_static/panel.js"
ASSET = Path(__file__).parent / "assets" / "panel.js"


def _owned(panel) -> bool:
    if panel is None or panel.component_name != "custom":
        return False
    custom = (panel.config or {}).get("_panel_custom", {})
    return (
        isinstance(custom, dict)
        and custom.get("name") == "kaleidescape-panel"
        and isinstance(custom.get("module_url"), str)
        and custom["module_url"].split("?")[0] == ASSET_URL
    )


async def async_setup_panel(hass: HomeAssistant) -> bool:
    """Serve only the compiled file, and refresh its URL when the build changes."""
    if not hass.data.get(f"{DOMAIN}.panel_asset_registered"):
        await hass.http.async_register_static_paths(
            [StaticPathConfig(ASSET_URL, str(ASSET), cache_headers=False)]
        )
        hass.data[f"{DOMAIN}.panel_asset_registered"] = True
    digest = await hass.async_add_executor_job(_asset_digest)
    module_url = f"{ASSET_URL}?v={digest}"
    existing = hass.data.get(frontend.DATA_PANELS, {}).get(PANEL_PATH)
    if existing is not None:
        custom = (existing.config or {}).get("_panel_custom", {})
        if not _owned(existing):
            raise ValueError("Companion panel path is already in use")
        if custom["module_url"] != module_url:
            config = {
                **existing.config,
                "_panel_custom": {**custom, "module_url": module_url},
            }
            frontend.async_register_built_in_panel(
                hass,
                component_name="custom",
                frontend_url_path=PANEL_PATH,
                sidebar_title=NAME,
                sidebar_icon="mdi:movie-open",
                config=config,
                require_admin=False,
                update=True,
            )
        return False
    await panel_custom.async_register_panel(
        hass,
        frontend_url_path=PANEL_PATH,
        webcomponent_name="kaleidescape-panel",
        sidebar_title=NAME,
        sidebar_icon="mdi:movie-open",
        module_url=module_url,
        require_admin=False,
    )
    return True


def _asset_digest() -> str:
    return hashlib.sha256(ASSET.read_bytes()).hexdigest()[:16]


@callback
def async_remove_panel(hass: HomeAssistant) -> None:
    """Remove the sidebar entry while retaining its harmless static module route."""
    if _owned(hass.data.get(frontend.DATA_PANELS, {}).get(PANEL_PATH)):
        frontend.async_remove_panel(hass, PANEL_PATH, warn_if_unknown=False)
