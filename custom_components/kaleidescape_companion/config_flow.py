"""Setup flow for the household Kaleidescape journal backend."""

from typing import Any

from homeassistant.config_entries import (
    ConfigEntry,
    ConfigFlow,
    ConfigFlowResult,
    OptionsFlowWithReload,
)
from homeassistant.core import callback

from .const import DOMAIN, NAME
from .core.runtime import KaleidescapeRuntime
from .core.settings import form, validate


class KaleidescapeConfigFlow(ConfigFlow, domain=DOMAIN):
    """Create one household journal with optional playback observation."""

    VERSION = 1

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Select existing HA entities without opening player connections."""
        await self.async_set_unique_id(DOMAIN)
        self._abort_if_unique_id_configured()

        errors = {}
        if user_input is not None:
            try:
                data = validate(self.hass, user_input, {})
            except ValueError as error:
                errors["base"] = str(error)
            else:
                return self.async_create_entry(title=NAME, data=data)

        return self.async_show_form(
            step_id="user", data_schema=form(self.hass, {}), errors=errors
        )

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: ConfigEntry) -> OptionsFlowWithReload:
        """Allow existing manual entries to enable observation without reinstalling."""
        return KaleidescapeOptionsFlow()


class KaleidescapeOptionsFlow(OptionsFlowWithReload):
    """Reconfigure one player and rules; reload to reconcile durable sessions."""

    async def async_step_init(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        config = dict(self.config_entry.options or self.config_entry.data)
        errors = {}
        if user_input is not None:
            try:
                updated = validate(self.hass, user_input, config)
            except ValueError as error:
                errors["base"] = str(error)
            else:
                runtime = getattr(self.config_entry, "runtime_data", None)
                if updated != config and isinstance(runtime, KaleidescapeRuntime):
                    # Removing an active HA panel sends its browser to the dashboard.
                    runtime.preserve_panel_on_reload = True
                return self.async_create_entry(title="", data=updated)
        return self.async_show_form(
            step_id="init",
            data_schema=form(self.hass, config),
            errors=errors,
        )
