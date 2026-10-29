"""Validated household display defaults; never credentials or browsing history."""

DEFAULTS = {
    "default_landing_page": "journal",
    "library_default_view": "list",
    "library_default_count": 50,
}
CHOICES = {
    "default_landing_page": [
        "now-playing",
        "library",
        "journal",
        "database",
        "settings",
    ],
    "library_default_view": ["list", "covers"],
}


def validate(values, previous):
    config = {
        key: values.get(key, previous.get(key, default))
        for key, default in DEFAULTS.items()
    }
    for key, choices in CHOICES.items():
        if config[key] not in choices:
            raise ValueError("invalid_display_options")
    count = config["library_default_count"]
    if type(count) not in {int, float} or not 1 <= count <= 1000 or count != int(count):
        raise ValueError("invalid_display_options")
    config["library_default_count"] = int(count)
    return config


def public_defaults(config):
    try:
        return validate({}, config)
    except ValueError, TypeError:
        return dict(DEFAULTS)
