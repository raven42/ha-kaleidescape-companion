# Kaleidescape Browser

A stand-alone Python client for the local movie browser on a Kaleidescape
server. It reads movie catalogs, version details, artwork and collections. It
can also submit supported collection changes after validating the server's form.
The project is maintained by Kaleidescape Companion contributors and distributed
under the [Apache License 2.0](LICENSE).

## Install and test

Activate a Python 3.14.2 or newer virtual environment and run these commands in
this directory. The client and its tests use only the Python standard library.

```sh
python -m pip install .
python -m unittest discover -s tests
```

The tests use fictional catalogs and transports. Construct
`KaleidescapeServerBrowser(host)` with a private IP to use the built-in HTTP
transport. Await `get_movies()` for the catalog or `get_movie_details(handle)`
for a specific version. Applications that own their HTTP session can pass a
`BrowserTransport` to `LocalLibrary` and reuse the same parsers and form checks.
