from enum import StrEnum
from typing import Annotated, Optional, cast

from pydantic import AfterValidator, BaseModel, Field, field_validator


class Rule(BaseModel):
    title: Annotated[
        str,
        Field(
            description='The title of the subreddit rule. Strip the leading "Rule" and any rule numbers if present. For instance, "Rule 1: This is an example rule" should be "This is an example rule".'
        ),
    ]
    description: Annotated[
        Optional[str],
        Field(
            default=None,
            description="Additional details for the rule, when available.",
        ),
    ]

    @field_validator("title", mode="after")
    def validate_title(cls, v: str) -> str:
        if v.strip().lower().startswith("Rule"):
            raise ValueError("Please remove the leading 'Rule' from the title.")
        return v


class RulesExtraction(BaseModel):
    rules: Annotated[
        list[Rule],
        Field(
            default_factory=list,
            description="Rules that apply to the subreddit, if any are published.",
        ),
    ]


class Subreddit(BaseModel):
    name: Annotated[
        str,
        Field(
            description="The name of the subreddit, excluding the r/ prefix. For example, the name of 'r/python' should be 'python'."
        ),
        AfterValidator(lambda name: cast(str, name).strip().lower().replace("r/", "")),
    ]
    description: Annotated[
        Optional[str],
        Field(
            default=None,
            description="The description of the subreddit, if available.",
        ),
    ]
    members_count: Annotated[
        int,
        Field(
            description="The number of members in the subreddit.",
        ),
    ]


class SelfPromotion(StrEnum):
    NOT_ALLOWED = "not_allowed"
    UNSPECIFIED = "unspecified"
    ALLOWED_FULL = "allowed_full"
    ALLOWED_LIMITED = "allowed_limited"


class SelfPromotionExtraction(BaseModel):
    justification: Annotated[
        str,
        Field(
            description="Justification for the self-promotion status. Should be 1 sentence and cite the relevant subreddit rules.",
        ),
    ]
    justification_short: Annotated[
        str,
        Field(
            description="A short summary of the self-promotion justification. Should be around 10 words and only capture the most important details for someone who's thinking about promoting in this subreddit.",
        ),
    ]
    self_promotion: Annotated[
        SelfPromotion,
        Field(
            description="The status of self-promotion in the subreddit.",
        ),
    ]
