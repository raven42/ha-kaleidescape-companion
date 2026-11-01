"""Small read-only predicate language; never execute caller-supplied SQL."""

import math
import re

from .models import JournalError
from .search import quoted

TOKEN = re.compile(
    r"\s*(?:(?P<string>'(?:[^']|'')*')|(?P<number>-?\d+(?:\.\d+)?)|(?P<word>[A-Za-z_][A-Za-z_0-9.]*)|(?P<op><=|>=|!=|<>|[=<>])|(?P<paren>[()]))"
)
OPERATORS = [
    "=",
    "!=",
    "<",
    "<=",
    ">",
    ">=",
    "IS NULL",
    "IS NOT NULL",
    "LIKE",
    "NOT LIKE",
    "CONTAINS",
]


def error(message, position):
    raise JournalError("query_syntax", f"{message} (position {position + 1})")


def compile_query(query, fields):
    """Return bound SQL/values for WHERE expressions or legacy literal search."""
    if not isinstance(query, str) or len(query) > 2000 or "\x00" in query:
        error("Query must be at most 2000 characters", 0)
    query = query.strip()
    if not query:
        return "", ()
    structured = query.upper().startswith("WHERE ") or bool(
        re.match(
            r"(?:\s*(?:\(|NOT\b))*\s*[A-Za-z_][A-Za-z_0-9.]*\s*"
            r"(?:[=<>!]|\b(?:IS|LIKE|CONTAINS|NOT LIKE)\b)",
            query,
            re.I,
        )
    )
    if not structured:
        if quoted(query):
            names = [name for name in fields if "." not in name]
            return "(" + " OR ".join(
                f"companion_matches(CAST({fields[name]['expression']} AS TEXT),?,0)"
                for name in names
            ) + ")", (query,) * len(names)
        value = (
            "%"
            + query.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
            + "%"
        )
        return "(" + " OR ".join(
            f"CAST({fields[name]['expression']} AS TEXT) LIKE ? ESCAPE '\\'"
            for name in fields
            if "." not in name
        ) + ")", (value,) * sum("." not in key for key in fields)
    if query.upper().startswith("WHERE "):
        query = query[6:]
    tokens = []
    cursor = 0
    while cursor < len(query):
        match = TOKEN.match(query, cursor)
        if not match:
            error("Expected a field, operator, quoted value or parenthesis", cursor)
        tokens.append(
            (
                match.lastgroup,
                match.group(match.lastgroup),
                match.start(match.lastgroup),
            )
        )
        cursor = match.end()
        if len(tokens) > 128:
            error("Use at most 128 query tokens", cursor)
    parser = Parser(tokens, fields)
    result = parser.expression()
    if parser.index < len(tokens):
        error(
            "Unexpected token; use AND or OR between conditions",
            tokens[parser.index][2],
        )
    return result, tuple(parser.values)


class Parser:
    def __init__(self, tokens, fields):
        self.tokens = tokens
        self.fields = fields
        self.index = 0
        self.values = []
        self.depth = 0

    def accept(self, *values):
        if (
            self.index < len(self.tokens)
            and self.tokens[self.index][1].upper() in values
        ):
            token = self.tokens[self.index]
            self.index += 1
            return token
        return None

    def take(self):
        if self.index == len(self.tokens):
            error("Incomplete condition", self.tokens[-1][2] + len(self.tokens[-1][1]))
        token = self.tokens[self.index]
        self.index += 1
        return token

    def expression(self):
        sql = self.conjunction()
        while self.accept("OR"):
            sql = f"({sql} OR {self.conjunction()})"
        return sql

    def conjunction(self):
        sql = self.condition()
        while self.accept("AND"):
            sql = f"({sql} AND {self.condition()})"
        return sql

    def condition(self):
        if self.accept("NOT"):
            self.depth += 1
            if self.depth > 8:
                error("Nesting limit is eight", self.tokens[self.index - 1][2])
            result = "NOT (" + self.condition() + ")"
            self.depth -= 1
            return result
        if self.accept("("):
            self.depth += 1
            if self.depth > 8:
                error("Nesting limit is eight", self.tokens[self.index - 1][2])
            result = self.expression()
            if not self.accept(")"):
                error("Expected closing parenthesis", self.tokens[self.index - 1][2])
            self.depth -= 1
            return "(" + result + ")"
        token = self.take()
        field = self.fields.get(token[1].lower())
        if token[0] != "word" or field is None:
            error("Unknown field; select a schema suggestion", token[2])
        expr = field["expression"]
        if self.accept("IS"):
            negative = bool(self.accept("NOT"))
            if not self.accept("NULL"):
                error("IS accepts NULL or NOT NULL", token[2])
            return f"{expr} IS {'NOT ' if negative else ''}NULL"
        negate = bool(self.accept("NOT"))
        operation = self.take()
        op = operation[1].upper()
        if op not in {"=", "!=", "<>", "<", "<=", ">", ">=", "LIKE", "CONTAINS"} or (
            negate and op != "LIKE"
        ):
            error("Expected =, !=, comparison, LIKE, CONTAINS or IS NULL", operation[2])
        value = self.take()
        if value[0] == "string":
            parsed = value[1][1:-1].replace("''", "'")
        elif value[0] == "number":
            parsed = float(value[1]) if "." in value[1] else int(value[1])
            if not math.isfinite(parsed) or abs(parsed) > 9e15:
                error("Number is too large", value[2])
        elif value[1].upper() in {"TRUE", "FALSE"}:
            parsed = int(value[1].upper() == "TRUE")
        else:
            error(
                "Quote text with single quotes; use IS NULL for missing values",
                value[2],
            )
        if op == "CONTAINS":
            if not isinstance(parsed, str):
                error("CONTAINS needs quoted text", value[2])
            self.values.append(parsed.casefold())
            if field["type"] == "array":
                return (
                    f"EXISTS (SELECT 1 FROM json_each({expr}) item "
                    "WHERE instr(companion_casefold(item.value),?)>0)"
                )
            return f"({expr} IS NOT NULL AND instr(companion_casefold({expr}),?)>0)"
        if op == "LIKE":
            if not isinstance(parsed, str):
                error("LIKE needs a quoted pattern", value[2])
            parsed = parsed.replace("*", "%")
        self.values.append(parsed)
        return f"{expr} {'NOT LIKE' if negate else op} ?"
