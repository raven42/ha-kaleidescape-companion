"""Administrator opt-ins, bounded request rate, and a write-only provider credential."""

from .selection import DEFAULTS as SOURCE_DEFAULTS
from .selection import configured

DEFAULTS = {
    **SOURCE_DEFAULTS,
    "metadata_store_enabled": False,
    "metadata_tmdb_enabled": False,
    "metadata_auto_save": False,
    "metadata_requests_per_second": 2,
    "metadata_tmdb_credential": "",
}


def validate(values, previous):
    result = {
        key: values.get(key, previous.get(key, default))
        for key, default in DEFAULTS.items()
    }
    configured(result)
    for key in (
        "metadata_store_enabled",
        "metadata_tmdb_enabled",
        "metadata_auto_save",
    ):
        if type(result[key]) is not bool:
            raise ValueError("invalid_metadata_options")
    rate = result["metadata_requests_per_second"]
    if type(rate) not in (int, float) or not 0.1 <= rate <= 10:
        raise ValueError("invalid_metadata_options")
    credential = result["metadata_tmdb_credential"]
    if (
        not isinstance(credential, str)
        or len(credential) > 1024
        or any(c.isspace() or ord(c) < 33 or ord(c) > 126 for c in credential)
    ):
        raise ValueError("invalid_metadata_options")
    clear = values.get("metadata_clear_tmdb_key", False)
    if type(clear) is not bool:
        raise ValueError("invalid_metadata_options")
    result["metadata_tmdb_credential"] = (
        "" if clear else credential or previous.get("metadata_tmdb_credential", "")
    )
    return result
