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


async def async_setup_panel(hass: HomeAssistant) -> None:
    """Serve only the compiled file, and refresh its URL when the build changes."""
    if not hass.data.get(f"{DOMAIN}.panel_asset_registered"):
        await hass.http.async_register_static_paths(
            [StaticPathConfig(ASSET_URL, str(ASSET), cache_headers=False)]
        )
        hass.data[f"{DOMAIN}.panel_asset_registered"] = True
    digest = await hass.async_add_executor_job(_asset_digest)
    await panel_custom.async_register_panel(
        hass,
        frontend_url_path=PANEL_PATH,
        webcomponent_name="kaleidescape-panel",
        sidebar_title=NAME,
        sidebar_icon="mdi:movie-open",
        module_url=f"{ASSET_URL}?v={digest}",
        require_admin=False,
    )


def _asset_digest() -> str:
    return hashlib.sha256(ASSET.read_bytes()).hexdigest()[:16]


@callback
def async_remove_panel(hass: HomeAssistant) -> None:
    """Remove the sidebar entry while retaining its harmless static module route."""
    frontend.async_remove_panel(hass, PANEL_PATH, warn_if_unknown=False)
