<p align="center">
  <img src="public/logo.png" alt="PromoterCat logo" width="200" />
</p>

[PromoterCat](https://www.promotercat.com/?utm_source=github&utm_medium=readme&utm_campaign=promotercat) helps you find subreddits where you can promote your product for free.

![PromoterCat showing subreddits and their promotion rules](public/screenshot.png)

## Run without Doppler

Copy `.env.example` to `.env.local` and fill in the values. Use `pnpm dev:local`
to start the local database and app. Docker must be running.

The CLI commands also load `.env.local`:

```sh
pnpm subreddits:local add --url https://www.reddit.com/r/opensource/
pnpm evals:local
```

The existing `dev`, `subreddits`, and `evals` commands keep their Doppler setup.

## License

[MIT](LICENSE)
