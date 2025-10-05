# Crypto News Token Rewards App

## Overview

This is a full-stack web application that combines cryptocurrency news consumption with token rewards. Users can read cryptocurrency news articles and earn ARB (Arbitrum) tokens by spending time reading articles. The application fetches real-time crypto news from the CryptoPanic API and implements a token reward system to incentivize user engagement.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The frontend uses React 18 with TypeScript in a modern component-based architecture:

- **Build System**: Vite for fast development and optimized production builds
- **Routing**: Wouter for lightweight client-side routing without the overhead of React Router
- **UI Framework**: Shadcn/ui component library built on Radix UI primitives for accessible components
- **Styling**: Tailwind CSS with a custom Arbitrum-inspired theme using CSS variables for consistent branding
- **State Management**: TanStack Query (React Query) for server state management, caching, and API synchronization
- **Mobile Optimization**: Responsive design with specific constraints for Farcaster miniapp integration (424x695px)

The choice of Wouter over React Router reduces bundle size while providing necessary routing functionality. Shadcn/ui was selected for its accessibility features and consistent design system.

### Backend Architecture
The backend follows RESTful API principles with Express.js:

- **Framework**: Express.js with TypeScript for type safety and better developer experience
- **API Design**: RESTful endpoints including `/api/news` for fetching articles and `/api/user/claim` for token rewards
- **External API Integration**: CryptoPanic API integration for real-time cryptocurrency news
- **Session Management**: Express sessions with PostgreSQL session store for user state persistence
- **Development Integration**: Vite middleware integration for seamless full-stack development experience

Express was chosen for its simplicity and extensive ecosystem, while the RESTful design ensures predictable API behavior.

### Data Storage Solutions
The application uses a flexible storage architecture supporting both development and production environments:

- **Production Database**: PostgreSQL hosted on Neon Database (serverless) for scalability and managed infrastructure
- **Development Storage**: In-memory storage implementation for rapid development and testing
- **ORM**: Drizzle ORM for type-safe database operations and automatic TypeScript type generation
- **Schema Management**: Drizzle Kit handles database migrations and schema synchronization
- **Session Storage**: PostgreSQL-backed session storage using connect-pg-simple for production persistence

Drizzle ORM was selected over alternatives like Prisma for its lightweight nature and excellent TypeScript integration. The dual storage approach allows for flexible development while maintaining production reliability.

### External Dependencies
- **CryptoPanic API**: Real-time cryptocurrency news aggregation service
- **Neon Database**: Serverless PostgreSQL hosting for production data storage
- **Radix UI**: Accessible component primitives for building the UI foundation
- **Replit Integration**: Development environment optimization with cartographer and runtime error overlay plugins
- **Web3 Libraries**: Rainbow Kit and Wagmi for potential blockchain wallet integration
- **Farcaster SDK**: Integration for Farcaster miniapp deployment and functionality

The application is designed for deployment as a Farcaster miniapp while maintaining compatibility as a standalone web application.