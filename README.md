# Pang DB

Pang DB is a lightweight PostgreSQL workbench for local use with `npx ampx sandbox`. It is built for sandbox sanity checks, connectivity testing, schema inspection, and ad hoc queries against RDS-backed development environments. It is not intended to be a production admin console.

## Intended Use

Pang DB is for:

- validating Amplify Gen 2 sandbox connectivity to RDS
- checking Secrets Manager, VPC, subnet, and security group wiring
- browsing schemas and tables during development
- running lightweight sanity-check SQL

Pang DB is not for:

- production operations
- multi-user administration
- audited write workflows
- long-term hosted deployment

## Screenshot

![Pang DB screenshot](docs/assets/pang-db-screenshot.png)

Caption: Pang DB running locally with a successful sandbox-backed connection, the schema explorer on the left, and the read-only SQL runner ready in the main workspace.

## Features

- connection health and database identity
- schema and table explorer
- paginated row browser with simple text filtering
- SQL runner with read-only mode enabled by default
- `DATABASE_URL` or `DATABASE_SECRET_ARN` configuration
- Amplify Gen 2 function for sandbox-side VPC access

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Copy `.env.example` to `.env` and fill in your AWS and database values.

3. Start the Amplify sandbox in one terminal:

```bash
npm run sandbox
```

4. Start Next.js in another terminal:

```bash
npm run dev
```

## AWS credentials

Local development uses your standard AWS SDK credential chain. The easiest setup is to configure credentials in `~/.aws/credentials`.

Example:

```ini
[default]
aws_access_key_id=YOUR_ACCESS_KEY_ID
aws_secret_access_key=YOUR_SECRET_ACCESS_KEY
```

Or use a named profile:

```ini
[pang-dev]
aws_access_key_id=YOUR_ACCESS_KEY_ID
aws_secret_access_key=YOUR_SECRET_ACCESS_KEY
```

Then start the app with that profile:

```bash
AWS_PROFILE=pang-dev npm run sandbox
AWS_PROFILE=pang-dev npm run dev
```

You can verify local AWS access with:

```bash
aws sts get-caller-identity
```

This matters for:

- `npx ampx sandbox` deployments
- local Next.js when invoking the sandbox Lambda
- local or Lambda-side access to Secrets Manager during development

## Environment contract

- `AWS_REGION`
- `AMPLIFY_VPC_ID`
- `AMPLIFY_SUBNET_IDS`
- `AMPLIFY_SECURITY_GROUP_IDS`
- `DATABASE_URL` or `DATABASE_SECRET_ARN`
- `DATABASE_SSL_MODE` (`disable`, `require`, `verify-full`, or `no-verify`)
- optional `DATABASE_SSL_CA_FILE`
- optional `DATABASE_SSL_CA_PEM`
- optional `AMPLIFY_DB_EXPLORER_FUNCTION_NAME`

## Secret formats

`DATABASE_SECRET_ARN` can point to a Secrets Manager secret containing any of these:

- plain text `postgres://...` connection string
- JSON with `url`, `uri`, `connectionString`, or `DATABASE_URL`
- JSON with `host`, `port`, `username`, `password`, and `dbname` or `database`

The sandbox Lambda now requires IAM permission to read that secret and a network path to Secrets Manager if it runs in private subnets.

## SSL verification

This project now supports full RDS CA bundle verification for both local Next.js and the sandbox Lambda.

- The default CA bundle path is `certs/rds/global-bundle.pem`
- The sandbox Lambda bundle copies that file into `/var/task/certs/rds/global-bundle.pem`
- You can override the path with `DATABASE_SSL_CA_FILE`
- You can inline the PEM with `DATABASE_SSL_CA_PEM`

Example:

```bash
DATABASE_SSL_MODE=verify-full
DATABASE_SSL_CA_FILE=certs/rds/global-bundle.pem
DATABASE_URL=postgres://user:password@host:5432/db?sslmode=verify-full&sslrootcert=certs/rds/global-bundle.pem
```

## Notes

- The Next.js API layer will invoke the Amplify Lambda when `AMPLIFY_DB_EXPLORER_FUNCTION_NAME` is available.
- If the function name is not available yet, the server falls back to the same shared Knex service locally so the UI can still be exercised during development.
- Lambda mode should return structured failures with a `stage` of `env`, `secret`, `network`, `ssl`, `auth`, or `query` instead of hanging until the full sandbox timeout when possible.
- Authentication is intentionally out of scope for this first version.
- This tool is optimized for sandbox verification and developer troubleshooting, not for production database administration.
