# Purchases and receipt imports

Companion keeps private purchase records separately from Library versions.
Receipts can be saved before the Library has been scanned and linked later.
Administrators inspect, reconcile and correct purchases; household Library
responses omit prices, orders, receipt links and invoice history.

The supported email workflow uses the bundled HA blueprint and an existing IMAP
integration. It is optional. Saved purchase-history HTML has a separate offline
preparation tool; it is not a panel upload format. Keep email, automation
traces, exports and receipt diagnostics private.

## Set up the IMAP blueprint

1. Configure the HA IMAP integration for the mailbox receiving the receipts.
2. In Companion **Settings → Automations**, find **Purchase receipt email**.
   Review the installed/bundled version and **Install**, **Update** or **Review
   replacement** as offered. A modified file is not replaced without review.
   Installing a blueprint does not create an automation.
3. Open **Home Assistant Blueprints**, select **Kaleidescape Companion - Import
   purchase receipts**, and create an automation using the intended IMAP entry.
4. Optionally set **Sender contains** to narrow matching mail. This checks text
   and does not authenticate the sender.
5. Select at least one field: transaction ID, purchase price, retail price or
   purchase date. Title and Store link are always extracted when available. Save
   and enable the automation.

For example, this automation uses the actual bundled input names; replace the
fictional IMAP entry ID with the selected entry from your own HA setup:

```yaml
alias: Import Kaleidescape receipts
use_blueprint:
  path: kaleidescape_companion/purchase_email_parser.yaml
  input:
    imap_entry: REPLACE_WITH_YOUR_IMAP_ENTRY_ID
    sender_filter: ""
    import_fields:
      - transaction-id
      - purchase-price
      - retail-price
      - purchase-date
```

The blueprint reacts to `imap_content` for that entry and a subject containing
“Kaleidescape Store Receipt”. It fetches the original message and HTML part; the
event preview alone is insufficient. Missing or unusable HTML produces a
notification and no import. Use the actual receipt event from the configured
mailbox for the first check; **Run actions** alone lacks the trigger fields.

## Check what was saved

After a matching receipt arrives, inspect the automation trace's
`purchase_import` response and Companion **Database → Purchases**. The response
distinguishes imported, updated, unchanged and pending counts plus review
issues. `needs_review` does not mean nothing was saved: valid matched and
unmatched items can be retained while other fields or items require attention.

Unselected fields are not stored. A missing selected date remains unknown;
forwarded mail does not use the forward date as its purchase date. Missing or
ambiguous prices and total/currency discrepancies are reported for review. Valid
partial records preserve their currency; no exchange-rate conversion is
performed. A set's price may be allocated across its included movies as an
estimate, not as evidence of itemized charges.

Fewer identity fields can make distinct purchases harder to distinguish. A
unique title match is a proposal, not independently verified movie identity;
review representative saved results, especially repeats, sets and editions.
Numeric Store IDs and local Library handles are different identifiers.

## Reconcile saved unmatched purchases

1. Enable and scan the intended Library, then open **Database → Reconcile
   purchases** as administrator in Advanced view.
2. Review the unlinked records, which start unchecked. Choose **Match title…**
   for an unresolved row and identify the correct available movie by title,
   year, director and versions. **Clear match** returns a row to unresolved.
3. Select only the verified matched rows. Inspect the proposed changes and
   choose **Apply N selected changes**.

This reads saved purchases directly; no JSON from an email trace is needed, and
automatic recording may stay enabled. Choosing a match changes the review until
you apply it. Unmatched rows cannot be selected for application, and
reconciliation does not create a new Library movie. A changed database or review
requires a fresh review.

## Duplicates, corrections and reversals

Unchanged normalized receipts are deduplicated, but changing a title, date,
order or link can change identity. Similar receipts can be held for review
without being saved. The similarity check can also flag a legitimate repeat
purchase or miss a duplicate. Inspect existing invoices before explicitly
accepting a held receipt as a separate purchase. Choosing a Library match does
not by itself approve that separate purchase.

For a linked movie, open **Library → movie → Purchase details → edit** to review
combined purchase information. Prices use a currency symbol and two decimal
places, such as fictional `$9.99`. **Purchase information unavailable** removes
the movie from missing-purchase checks without erasing stored values. Existing
populated fields are not silently overwritten by a new receipt.

To correct an invoice's title, date, prices, transaction ID or Store link, open
**Database → Purchases**, select it and choose **Edit entry**. Review the
before/after receipt, associations and recalculated totals, then confirm. Its
Library association is read-only in that correction dialog. Identity collisions
are rejected and prior identities remain replay barriers.

**Database → Options → Show system tables → Purchase repair history** exposes
the retained correction evidence. Select an event and use **Review reversal** to
inspect a proposed reversal before confirming. A changed record or reserved
identity, unavailable destination or already reversed event can block reversal;
do not treat it as an unconditional undo.

## Troubleshoot and retry

| Outcome                                           | Recovery                                                                                                                                                             |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nothing imported; HTML unavailable                | Check the IMAP fetch/part result, mailbox and blueprint version. No parsed purchases exist to reconcile from that failed extraction.                                 |
| Saved without a Library match                     | Scan Library, then reconcile the saved rows. Do not repeatedly replay the email merely to obtain a match.                                                            |
| Linked purchase has missing or conflicting values | Inspect the action response and original receipt, then use the purchase editor or reviewed correction. Unlinked reconciliation does not overwrite a linked conflict. |
| Possible duplicate held for review                | Compare the original receipt with existing invoices before approving a separate purchase.                                                                            |
| Automation failed after import                    | Inspect the import response and saved rows first; a failed notification step does not roll back an accepted import.                                                  |
| Reversal or apply became stale                    | Reload and review current records. Retain the same retry when its result is unconfirmed instead of creating a new write blindly.                                     |

For a necessary retry of the same mailbox message, use the original trace's
`entry_id`, `uid`, `subject` and `sender` to fire `imap_content` in HA Developer
Tools → Events. Keep the message in the same mailbox so its UID still identifies
it. Read/unread toggling is not a reliable replay method. Inspect the ledger
first, since forwarding or editing mail can change its normalized identity.

Disable the receipt automation in HA to stop new automatic imports. This does
not delete saved purchases. Receipts, repair evidence and uncertainty/replay
barriers need a compatible full restore if recovering a database; a JSON merge
does not restore all those protections. See
[data management](data-management.md).

Receipt format and actual IMAP transport qualification remain open. The current
temporary diagnostics can log bounded full email/HTML and parsed results at
warning or debug; protect logs and traces as private email. Share sanitized
reason values, not raw messages. The
[automation contract](../development/automations.md) and
[purchase rules](../development/data-management.md#import-purchase-history-json)
define the exact parsing, matching and mutation limits.
