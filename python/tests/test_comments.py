import json
from pathlib import Path

import mdi
import pytest

FIXTURES = json.loads((Path(__file__).parents[2] / "mdi-core/tests/fixtures/comments/cases.json").read_text())


def values(node):
    return ([node["value"]] if node.get("type") == "comment" else []) + [value for child in node.get("children", []) for value in values(child)]


@pytest.mark.parametrize("fixture", FIXTURES, ids=lambda fixture: fixture["name"])
def test_shared_comments(fixture):
    source = fixture["source"]
    assert values(mdi.parse(source)["document"]) == []
    full = mdi.parse(source, include_comments=True)
    assert full["irVersion"] == mdi.MDI_COMMENT_IR_VERSION == "1.1"
    assert values(full["document"]) == fixture["values"]
    assert values(mdi.parse(mdi.serialize_mdi(source), include_comments=True)["document"]) == fixture["values"]


def test_publications_stay_comment_free():
    source = "前<!--UNIQUE_SENTINEL-->後"
    assert mdi.render_text(source) == "前後\n"
    assert "UNIQUE_SENTINEL" not in mdi.render_html(source)
