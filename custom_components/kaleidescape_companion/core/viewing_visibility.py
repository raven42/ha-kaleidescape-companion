"""Shared Journal visibility for short observed playback attempts."""


def visible_viewing(alias=""):
    """Keep diagnostics, but only count substantial or completed viewings."""
    prefix = f"{alias or 'viewings'}."
    return (
        f"({prefix}origin='manual' OR {prefix}status='completed' "
        f"OR {prefix}manual_fields != '[]' OR EXISTS "
        f"(SELECT 1 FROM sessions visibility_session WHERE "
        f"visibility_session.viewing_id={prefix}id "
        "AND visibility_session.watched_seconds>=companion_partial_minimum()) OR "
        f"({prefix}watched_seconds>=companion_partial_minimum() AND NOT EXISTS "
        f"(SELECT 1 FROM sessions visibility_session WHERE "
        f"visibility_session.viewing_id={prefix}id)))"
    )
