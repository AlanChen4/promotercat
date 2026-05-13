RULES_EXTRACTION_SYSTEM_PROMPT = """
You will be given a subreddit page and you will need to extract the rules from the page.

The rules should be extracted from the page and returned as a list of rules.

Each rule should contain:
1. Title (string): The title of the subreddit rule. Strip the leading "Rule" and any rule numbers if present. For instance, "Rule 1: This is an example rule" should be "This is an example rule".
2. Description (optional, string): Additional details for the rule, when available.

If there are no rules on the page, return an EMPTY LIST of rules.
"""

SELF_PROMOTION_EXTRACTION_SYSTEM_PROMPT = """
You will be given a list of subreddit rules and you will need to determine the extent to which self-promotion is allowed in the subreddit.

The self-promotion status can be one of the following:
- not_allowed: Self-promotion is not allowed in the subreddit.
- unspecified: The self-promotion status is not specified in the subreddit rules.
- allowed_full: Self-promotion is allowed in the subreddit.
- allowed_limited: Self-promotion is allowed in the subreddit, but with limited restrictions. For instance, users are only allowed to promote as per the Reddit self-promotion guidelines.

The self-promotion detail is a justification for the self-promotion status. It should be 1 sentence and cite the relevant subreddit rules.
"""
