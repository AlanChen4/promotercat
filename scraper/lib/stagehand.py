from typing import Any


# Block images to reduce costs.
# https://docs.browserbase.com/guides/cost-optimization#python
async def block_images(route: Any, request: Any):
    if request.resource_type == "image":
        await route.abort()
    else:
        await route.continue_()
