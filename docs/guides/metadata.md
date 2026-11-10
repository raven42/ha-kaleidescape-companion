# Metadata and artwork

Metadata enrichment adds public Store or TMDB facts to the locally scanned
Library. It is optional and separate from device scanning and recording.
Administrators enable providers and review matches; household users see the
allowed resulting Library details. Both providers are disabled by default.

## Prerequisites and setup

1. Enable and sync the [Library](journal-and-library.md#sync-the-library).
2. Open **Settings → Metadata** and enable **Kaleidescape Store**, **TMDB**, or
   both. Store uses public pages without a login. For TMDB, supply your own API
   key or API Read Access Token.
3. Keep the request rate conservative; its default is two requests per second
   shared by the providers, with a supported range of 0.1–10. Store policy can
   reduce the rate further.
4. Choose preferred sources and whether metadata-manager changes should
   auto-save, then **Save settings**. The default is to review and save changes
   explicitly.

Leaving the TMDB credential field blank keeps the stored secret. **Remove**
stages removal until Save; **Undo** cancels it. The saved credential is not
returned to the form. Internet providers can see the requested movie and HA's
network address; Companion does not send Journal history, notes, invoices or
order IDs. HA's full backups can include the private TMDB credential.

## Smallest useful refresh

With one provider saved and enabled, choose **Refresh metadata** in Settings,
then **Check metadata status**. A pass reports progress, updates, skipped
matches and errors. Library scans do not trigger enrichment. Skipped attempts
need review and do not mean the provider found the correct movie.

For a missing-only TMDB pass from an HA action, after the same prerequisites:

```yaml
action: kaleidescape_companion.refresh_metadata
data:
  providers:
    - tmdb
  only_missing: true
```

This requests a background job; it does not wait for all downloads. Check the
status before interpreting the result. An empty provider list means all enabled
providers. The optional metadata blueprint can schedule the same operation; see
[entities and automations](entities-and-automations.md).

Successful cached metadata should appear in the Library's credits, synopsis,
ratings and source information according to your preferences. A group enriched
by two providers still represents one Library movie. Unknown years, missing
credentials and ambiguous matches can be skipped; source versions and watched
history are not changed by a provider match.

## Review one movie

1. As administrator in Advanced view, open a Library movie and choose **Scrape
   title**.
2. In the metadata manager, select a source, review the search title/year and
   choose **Refresh**. Refresh searches again even if that provider has cached
   data.
3. If several candidates appear, choose the correct movie using its details. An
   empty result may warrant a search without the year; it is not permission to
   accept a different movie.
4. Open **Field Mapping** to compare the original Library field and each
   provider's cached value. Choose the intended source for individual fields.
5. With auto-save off, choose **Save** to commit the reviewed draft. With
   auto-save on, individual changes save immediately.

The original scan and each provider cache remain separate. **History** shows
recent checks and saved provider values, up to eight entries per provider. It is
not a full audit trail. A match link opens the approved public movie page; it
does not establish that a specific local edition contains every Store feature.

With auto-save off, closing the manager discards the draft. Reviews expire after
twenty minutes or can become stale after other changes; reopen and review the
current movie instead of blindly applying an old choice. On an unconfirmed save,
inspect/retry through the same dialog before submitting a different operation.

## Select covers and backdrops

Enable **Sync artwork** in Library settings as well as TMDB if you want TMDB
images. Choose TMDB as the preferred cover source, save settings and request a
metadata refresh. Original edition covers are retained. Backdrops also require
TMDB and artwork sync; they share the configured artwork cache budget.

In a movie's metadata manager, **Edit** below a cover or backdrop opens the
available TMDB image choices. Select an image and save according to the current
auto-save mode. **Reset** restores the original scanned cover; backdrop Reset
restores the previously selected backdrop or removes it when there was none. An
unavailable-image checkbox declares that image unavailable for completeness
checks; it does not download an image.

Shared source preferences in Settings apply to cached fields without requiring a
new scrape. **Original library data** uses only the scanned field. A named
provider prefers its populated value and falls back when missing. Per-movie
reviewed choices take priority. Choosing a source does not enable that provider.

## Common failures and recovery

| Result                                              | Next step                                                                                                                                                    |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| TMDB credential missing or rejected                 | Review the saved provider configuration; replace the credential and Save before retrying. Do not share it in a support report.                               |
| No match, unknown year or several plausible matches | Review the specific movie and candidates. Automatic matching is conservative and can leave unresolved titles.                                                |
| Rate limit, HTTP error or policy refusal            | Inspect the bounded status/reason, wait or correct the configuration as appropriate, then request a new pass. There is no automatic retry after HTTP errors. |
| Cover or backdrop remains absent                    | Confirm artwork sync, provider enablement, preferred source and the movie's availability/source switches. Check whether the cache evicted the image.         |
| Save is stale or review expired                     | Reopen the manager and review fresh data; retain manual intent without reusing a stale review.                                                               |
| Refresh is already active                           | Inspect its status. Repeated ordinary refresh requests coalesce; selected passes can report busy rather than discard their options.                          |

Disable a provider and save to stop future provider requests. Cached metadata
remains readable while Library is enabled. Per-movie source switches exclude a
provider from that movie's future automatic attempts and completeness checks
while retaining its cache. Disable a schedule separately if it should stop
requesting jobs.

Public HTML/API behavior, real credentials and browser presentation still need
external qualification. Store prices are current retail metadata, not proof of
what was paid; Store badges are inferences, not proof of a downloaded
soundtrack. See the [metadata contract](../development/metadata.md) for
matching, limits, provenance and exact source-selection behavior.
