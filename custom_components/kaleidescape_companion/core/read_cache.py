"""Worker-local, byte-bounded memoization for pure SQLite display functions.

Keys contain complete scalar inputs or explicit source revisions for facets,
so edits/imports naturally miss the cache.
This is an optimization only: authorization and positive response projections
still run on every request. Nothing is written to disk or exported.
"""

from collections import OrderedDict
from contextlib import contextmanager
from copy import deepcopy
from sys import getsizeof

from .search import Matcher, matches

MAX_CACHE_BYTES = 15 * 1024 * 1024
MAX_CACHE_ITEMS = 4096


def size(value):
    # Include Python's actual string representation without encoding JSON again.
    # Facets use bounded, acyclic containers built by our positive projections.
    own = getsizeof(value)
    if isinstance(value, dict):
        return own + sum(size(key) + size(item) for key, item in value.items())
    if isinstance(value, (list, tuple)):
        return own + sum(size(item) for item in value)
    return own


class Memo:
    def __init__(self, *, max_bytes=MAX_CACHE_BYTES, max_items=MAX_CACHE_ITEMS - 1):
        self.items = OrderedDict()
        self.bytes = 0
        self.max_bytes = max_bytes
        self.max_items = max_items

    def clear(self):
        self.items.clear()
        self.bytes = 0

    def call(self, function, *args):
        key = (function, *args)
        if key in self.items:
            result, cost = self.items.pop(key)
            self.items[key] = (result, cost)
            return (
                deepcopy(result) if isinstance(result, (dict, list, tuple)) else result
            )
        result = function(*args)
        cost = 512 + sum(size(value) for value in args) + size(result)
        if cost <= self.max_bytes:
            while self.items and (
                self.bytes + cost > self.max_bytes or len(self.items) >= self.max_items
            ):
                _, (_, removed) = self.items.popitem(last=False)
                self.bytes -= removed
            snapshot = (
                deepcopy(result) if isinstance(result, (dict, list, tuple)) else result
            )
            self.items[key] = (snapshot, cost)
            self.bytes += cost
        return result


class ReadCache:
    def __init__(self):
        self.projections = Memo()
        # Keep one small facet snapshot separate, so walking a catalog larger
        # than the projection cache cannot evict it and cause another full scan.
        self.facets = Memo(max_bytes=1024 * 1024, max_items=1)
        self.matchers = None
        self.credit_ranks = {}

    def clear(self):
        self.projections.clear()
        self.facets.clear()

    @contextmanager
    def search(self):
        previous, self.matchers = self.matchers, {}
        try:
            yield
        finally:
            for matcher in self.matchers.values():
                matcher.clear()
            self.matchers = previous
            self.credit_ranks = {}

    def matches(self, value, query, fuzzy):
        if self.matchers is None:
            return matches(value, query, fuzzy)
        key = (query, bool(fuzzy))
        if key not in self.matchers:
            # Fixed SQL currently supplies one query, never arbitrary expressions.
            # Keep a hard bound if a future caller supplies several predicates.
            if len(self.matchers) >= 8:
                return matches(value, query, fuzzy)
            self.matchers[key] = Matcher(query, fuzzy, cached=True)
        return self.matchers[key](value)

    def relevance(self, value, group, query, fuzzy):
        key = (query, bool(fuzzy))
        if self.matchers is None:
            matcher = Matcher(query, fuzzy)
        else:
            if key not in self.matchers:
                self.matchers[key] = Matcher(query, fuzzy, cached=True)
            matcher = self.matchers[key]
        title = matcher.library_relevance(value, "title")
        return max(title, self.credit_ranks.get(group, 0))
