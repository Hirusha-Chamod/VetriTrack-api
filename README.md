<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).

# VetriTrack API - Setup & Installation Guide

## Overview
VetriTrack is a NestJS-based REST API for managing veterinary inventory, suppliers, purchase orders, stock transactions, and approval workflows.

## Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **MongoDB**: Cloud (MongoDB Atlas) or local instance
- **Git**: For version control

## Installation Steps

### 1. Clone the Repository
```bash
git clone <repository-url>
cd VetriTrack-api
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration
Create a `.env` file in the root directory with the following variables:

```env
# Database
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/?appName=YourApp

# JWT Authentication
JWT_SECRET=your_secure_jwt_secret_key_here

# Server
PORT=3000
```

**Environment Variables Explanation:**
- `MONGO_URI`: MongoDB connection string (Atlas or local)
- `JWT_SECRET`: Secret key for JWT token generation (use a strong, random string)
- `PORT`: Server port (default: 3000)

### 4. Verify Installation
```bash
npm run build
```

## Running the Application

### Development Mode (with auto-reload)
```bash
npm run start:dev
```
Server runs on `http://localhost:3000`

### Production Mode
```bash
npm run build
npm run start:prod
```

### Debug Mode
```bash
npm run start:debug
```
Runs with Node debugger attached on port 9229

## Testing

### Unit Tests
```bash
npm run test
```

### Watch Mode (re-run on changes)
```bash
npm run test:watch
```

### E2E Tests
```bash
npm run test:e2e
```

### Test Coverage Report
```bash
npm run test:cov
```

## Code Quality

### Linting & Formatting
```bash
# Check for linting errors
npm run lint

# Auto-format code
npm run format
```

## Database Setup

### MongoDB Atlas (Cloud)
1. Create account at [mongodb.com](https://www.mongodb.com)
2. Create a cluster
3. Add database user credentials
4. Get connection string
5. Add string to `.env` as `MONGO_URI`

### Local MongoDB
```bash
# Install MongoDB Community Edition
# macOS:
brew tap mongodb/brew
brew install mongodb-community

# Start MongoDB:
brew services start mongodb-community

# Connection string:
MONGO_URI=mongodb://localhost:27017/vetritrack
```

## Project Structure
```
src/
├── app.module.ts          # Root module
├── app.controller.ts      # Root controller
├── app.service.ts         # Root service
├── main.ts                # Application entry point
│
├── auth/                  # Authentication module
│   ├── auth.service.ts
│   ├── auth.controller.ts
│   ├── jwt.strategy.ts
│   ├── schemas/
│   ├── dto/
│   ├── decorators/
│   └── guards/
│
├── inventory/             # Inventory management
│   ├── inventory.service.ts
│   ├── inventory.controller.ts
│   ├── schemas/
│   └── dto/
│
├── suppliers/             # Supplier management
│   ├── suppliers.service.ts
│   ├── suppliers.controller.ts
│   ├── schemas/
│   └── dto/
│
├── purchase-orders/       # Purchase order management
│   ├── purchase-orders.service.ts
│   ├── purchase-orders.controller.ts
│   ├── schemas/
│   └── dto/
│
├── transactions/          # Stock transactions (FEFO)
│   ├── transactions.service.ts
│   ├── transactions.controller.ts
│   ├── schemas/
│   └── dto/
│
├── approvals/             # Purchase approval workflow
│   ├── approvals.service.ts
│   ├── approvals.controller.ts
│   ├── schemas/
│   └── dto/
│
└── filters/               # Global exception filter
    └── exception-filter.ts
```

## Troubleshooting

### Port Already in Use
```bash
# Change port in .env
PORT=3001

# Or kill process using port 3000 (macOS/Linux):
lsof -ti:3000 | xargs kill -9
```

### MongoDB Connection Error
- Verify `MONGO_URI` is correct
- Check MongoDB is running
- Ensure IP whitelist includes your machine (Atlas)
- Test connection with MongoDB Compass

### JWT Token Issues
- Ensure `JWT_SECRET` is set in `.env`
- Token expires in 1 day (see `auth.module.ts`)
- Include Bearer token in Authorization header

### Build Errors
```bash
npm run build
# Check tsconfig.json settings if TypeScript errors occur
```

## NPM Scripts Reference
| Command | Purpose |
|---------|---------|
| `npm run start` | Start production server |
| `npm run start:dev` | Start with file watcher |
| `npm run start:debug` | Start with debugger |
| `npm run build` | Compile TypeScript |
| `npm run test` | Run unit tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:e2e` | Run E2E tests |
| `npm run test:cov` | Generate coverage report |
| `npm run lint` | Check code style |
| `npm run format` | Auto-format code |

## Required Dependencies

### Core NestJS
- `@nestjs/common` - Core framework
- `@nestjs/core` - Core framework
- `@nestjs/platform-express` - Express integration

### Database & ORM
- `@nestjs/mongoose` - MongoDB integration
- `mongoose` - MongoDB ODM

### Authentication
- `@nestjs/jwt` - JWT tokens
- `@nestjs/passport` - Passport integration
- `passport-jwt` - JWT strategy
- `bcryptjs` - Password hashing

### Configuration
- `@nestjs/config` - Environment variables

### Validation
- `class-validator` - DTO validation
- `class-transformer` - DTO transformation

### File Upload
- `@nestjs/platform-express` - File upload handling

### Excel/CSV Import
- `xlsx` - Excel file parsing

See [package.json](package.json) for complete dependencies.

## Next Steps
1. Review [API Endpoints Documentation](./API_ENDPOINTS.md)
2. Check [Middleware & Guards Documentation](./MIDDLEWARE.md)
3. Review authentication flow in [src/auth](src/auth)
4. Test endpoints with Postman/Insomnia

## Support
For issues, check the error logs in console output or MongoDB Atlas logs.
