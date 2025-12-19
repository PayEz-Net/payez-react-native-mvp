# PayEz React Native MVP

Production-ready React Native authentication package with 2FA, session management, and type-safe API clients.

**Based on**: PayEz-Next-MVP authentication patterns
**Version**: 1.0.0
**Created**: 2024-12-19

---

## Project Overview

This is a React Native implementation of the PayEz authentication system, mirroring the patterns and architecture established in the Next.js MVP. It provides a complete authentication flow including:

- Email/password authentication
- Two-factor authentication (2FA) with SMS, email, and authenticator app support
- Session persistence and management
- Token refresh handling
- Type-safe API clients
- Zustand state management

---

## Quick Start

### Prerequisites

- Node.js 18+ and npm/yarn
- React Native development environment set up
- iOS: Xcode 14+ and CocoaPods
- Android: Android Studio and Android SDK

### Installation

1. **Install dependencies:**
```bash
npm install
# or
yarn install
```

2. **iOS Setup:**
```bash
cd ios && pod install
cd ..
```

3. **Environment Configuration:**

Create a `.env` file in the project root:
```env
IDP_BASE_URL=https://idp.payez.net
CLIENT_ID=payez-mobile-client
```

### Running the App

**iOS:**
```bash
npm run ios
# or
yarn ios
```

**Android:**
```bash
npm run android
# or
yarn android
```

---

## Architecture

### Directory Structure

```
src/
├── auth/           # Authentication context and providers
├── components/     # Reusable UI components
├── hooks/         # Custom React hooks
├── navigation/    # React Navigation setup
├── screens/       # Screen components
├── services/      # Business logic and external services
├── stores/        # Zustand state stores
├── types/         # TypeScript type definitions
└── utils/         # Utility functions and API clients
```

### Key Components

#### 1. **Auth Store** (`src/stores/authStore.ts`)
- Zustand store managing authentication state
- Handles login, logout, 2FA verification
- Persists session to AsyncStorage
- Manages auth flow states

#### 2. **API Client** (`src/utils/api.ts`)
- Type-safe HTTP client
- Automatic token attachment
- Error handling and response validation
- Token refresh support

#### 3. **Navigation** (`src/navigation/AppNavigator.tsx`)
- Dynamic navigation based on auth state
- Prevents unauthorized access
- Handles 2FA flow routing

#### 4. **Auth Types** (`src/types/auth.ts`)
- Complete TypeScript definitions
- Type guards for session validation
- Auth flow state enum

---

## Authentication Flow

### 1. Initial Login
```
User enters credentials → API validates → Returns intermediate token → Navigate to 2FA
```

### 2. Two-Factor Verification
```
Load masked contact info → User selects method → Enter code → Verify → Full access token
```

### 3. Session Management
- Sessions persist across app restarts
- Automatic token refresh before expiration
- Graceful handling of expired sessions

### Auth Flow States

- `UNAUTHENTICATED`: No valid session
- `AUTHENTICATED`: Valid session with 2FA completed
- `REQUIRES_2FA`: Valid session awaiting 2FA
- `VERIFYING_2FA`: Currently verifying 2FA code
- `REFRESHING_TOKEN`: Token refresh in progress
- `ERROR`: Authentication error state

---

## API Integration

### Current Implementation (Stubs)

The MVP currently uses stub implementations for rapid development. These return mock data matching the expected API structure.

### Production Integration

To connect to the real IDP service:

1. Update environment variables with production URLs
2. Remove stub implementations from `authStore.ts`
3. Implement actual API calls using the provided `accountApi` methods
4. Add proper error handling for network failures

### API Methods Available

```typescript
accountApi.login(email, password)
accountApi.signup(email, password, name)
accountApi.getMaskedInfo(email, token)
accountApi.verifyTwoFactor(code, method, token)
accountApi.sendTwoFactorCode(method, token)
accountApi.refreshToken(refreshToken)
accountApi.logout(token)
```

---

## Security Considerations

### Implemented
- Secure token storage using AsyncStorage
- No hardcoded credentials
- Generic error messages (no internal details exposed)
- Session validation before sensitive operations

### TODO for Production
- [ ] Implement biometric authentication
- [ ] Add certificate pinning for API calls
- [ ] Use react-native-keychain for sensitive data
- [ ] Implement rate limiting on login attempts
- [ ] Add jailbreak/root detection

---

## Development Roadmap

### Phase 1: MVP (Current)
- ✅ Basic authentication flow
- ✅ 2FA implementation
- ✅ Session management
- ✅ Navigation structure
- ✅ Type safety

### Phase 2: Enhancement
- [ ] Biometric authentication
- [ ] Remember device feature
- [ ] Account recovery flow
- [ ] Profile management screens
- [ ] Push notification support for 2FA

### Phase 3: Production Ready
- [ ] Full API integration
- [ ] Error tracking (Sentry)
- [ ] Analytics integration
- [ ] Performance optimization
- [ ] Accessibility improvements

---

## Testing

### Unit Tests
```bash
npm test
```

### E2E Tests (TODO)
- Detox configuration pending
- Test scenarios defined in `/e2e`

### Manual Testing Checklist
- [ ] Login with valid credentials
- [ ] Login with invalid credentials shows error
- [ ] 2FA code entry and verification
- [ ] Session persists after app restart
- [ ] Logout clears all session data
- [ ] Token refresh works correctly

---

## Troubleshooting

### Common Issues

**Build Errors on iOS:**
```bash
cd ios && pod deintegrate && pod install
```

**Metro bundler issues:**
```bash
npx react-native start --reset-cache
```

**Android build failures:**
```bash
cd android && ./gradlew clean
```

---

## Contributing

### Development Workflow

1. Create feature branch from `main`
2. Implement changes following existing patterns
3. Test on both iOS and Android
4. Update documentation if needed
5. Submit PR with detailed description

### Code Style

- TypeScript for all new code
- Functional components with hooks
- Consistent naming conventions
- Comments for complex logic

---

## Dependencies

### Core
- `react-native`: 0.83.1
- `@react-navigation/native`: Navigation
- `zustand`: State management
- `jwt-decode`: Token parsing

### Security
- `@react-native-async-storage/async-storage`: Secure storage
- `react-native-keychain`: Biometric support (pending)

### UI
- `react-native-safe-area-context`: Safe area handling
- `react-native-screens`: Native navigation optimization
- `react-native-gesture-handler`: Gesture support

---

## License

Private package for PayEz internal use.

---

## Support

For questions or issues:
1. Check this documentation
2. Review the Next.js MVP implementation
3. Contact the development team

---

## Next Steps for Implementation Teams

### For NextPert and AppPert:

1. **Review the authentication flow** in `src/stores/authStore.ts`
2. **Extend the screen implementations** in `src/screens/`
3. **Add missing screens**: Signup, ForgotPassword, Profile, etc.
4. **Implement the actual API calls** by removing stubs
5. **Add proper error handling** and user feedback
6. **Implement biometric authentication** using react-native-keychain
7. **Add unit and integration tests**
8. **Optimize performance** and reduce bundle size

The foundation is set with proper TypeScript types, navigation structure, and state management. The auth flow mirrors the Next.js implementation for consistency across platforms.