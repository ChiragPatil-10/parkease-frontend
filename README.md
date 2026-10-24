# ParkeaseFrontend

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 22.1.3.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.

## Razorpay key id

The booking page needs the **public** Razorpay key id. Without it the page shows "Payments are not configured" and Pay stays disabled.

1. Get the key id from the Razorpay Dashboard: **Account & Settings → API Keys**. Use a test key (`rzp_test_...`) while developing.
2. Copy `.env.example` to `.env` and set `RAZORPAY_KEY_ID=rzp_test_xxxxxxxx`. On a build server, set `RAZORPAY_KEY_ID` as a real environment variable instead; it takes priority over `.env`.
3. Run `npm start`, `npm run build` or `npm test`. Each first runs `scripts/generate-env.mjs`, which writes the git-ignored `src/environments/environment.generated.ts`. The script never prints the value.

Only the public key id belongs here, never the key secret. The script refuses any value that is not shaped like `rzp_test_...` or `rzp_live_...`. The key id is embedded in the built JavaScript, so anyone who opens the app can read it; that is expected for a public key id.

Run builds through the npm scripts. Calling `ng build` directly skips the generation step and fails if `environment.generated.ts` does not exist yet.
