"""Development-only setup flow for the Kaleidescape framework."""

from typing import Any

import voluptuous as vol
from homeassistant.config_entries import ConfigFlow, ConfigFlowResult

from .const import DOMAIN, NAME


class KaleidescapeConfigFlow(ConfigFlow, domain=DOMAIN):
    """Create one inert configuration entry until source setup is implemented."""

    VERSION = 1

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Present the scaffold's setup confirmation."""
        await self.async_set_unique_id(DOMAIN)
        self._abort_if_unique_id_configured()

        if user_input is not None:
            return self.async_create_entry(title=NAME, data={})

        return self.async_show_form(step_id="user", data_schema=vol.Schema({}))
