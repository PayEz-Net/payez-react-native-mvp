# PayEz React Native MVP - Setup Guide

## Development Environment Setup

### Prerequisites

#### System Requirements
- **macOS**: 10.15+ (for iOS development)
- **Windows/Linux**: Latest stable version (Android only)
- **RAM**: 8GB minimum, 16GB recommended
- **Storage**: 10GB free space

#### Software Requirements

1. **Node.js & npm**
   - Node.js 18.0 or higher
   - npm 8.0 or higher
   ```bash
   node --version  # Should show v18.x.x or higher
   npm --version   # Should show 8.x.x or higher
   ```

2. **React Native CLI**
   ```bash
   npm install -g react-native-cli
   ```

3. **Watchman** (macOS/Linux)
   ```bash
   brew install watchman  # macOS
   ```

---

## iOS Development Setup (macOS only)

### 1. Install Xcode
- Download from Mac App Store (14GB+)
- Version 14.0 or higher required
- Open Xcode and accept license agreements

### 2. Install Xcode Command Line Tools
```bash
xcode-select --install
```

### 3. Install CocoaPods
```bash
sudo gem install cocoapods
```

### 4. Install iOS Dependencies
```bash
cd ios
pod install
cd ..
```

---

## Android Development Setup

### 1. Install Java Development Kit (JDK)
- JDK 11 or JDK 17 recommended
```bash
# macOS with Homebrew
brew install --cask zulu11

# Verify installation
java -version
```

### 2. Install Android Studio
- Download from [developer.android.com](https://developer.android.com/studio)
- During installation, ensure these are selected:
  - Android SDK
  - Android SDK Platform
  - Android Virtual Device (AVD)

### 3. Configure Android SDK
1. Open Android Studio
2. Go to Settings/Preferences → Appearance & Behavior → System Settings → Android SDK
3. Install:
   - Android 13 (API 33) or higher
   - Android SDK Build-Tools 33.0.0 or higher
   - Android SDK Platform-Tools
   - Android Emulator

### 4. Set Environment Variables

**macOS/Linux** (add to `~/.bash_profile` or `~/.zshrc`):
```bash
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH=$PATH:$ANDROID_HOME/tools
export PATH=$PATH:$ANDROID_HOME/tools/bin
```

**Windows** (System Environment Variables):
```
ANDROID_HOME = C:\Users\[username]\AppData\Local\Android\Sdk
Add to PATH:
- %ANDROID_HOME%\platform-tools
- %ANDROID_HOME%\emulator
- %ANDROID_HOME%\tools
- %ANDROID_HOME%\tools\bin
```

### 5. Verify Android Setup
```bash
adb --version
```

---

## Project Setup

### 1. Clone the Repository
```bash
git clone https://payez@dev.azure.com/payez/PayEz%20React%20Native%20MVP/_git/PayEz%20React%20Native%20MVP
cd PayEzReactNativeMVP
```

### 2. Install Dependencies
```bash
npm install
# or
yarn install
```

### 3. iOS-specific Setup
```bash
cd ios
pod install
cd ..
```

### 4. Environment Configuration

Create `.env` file in project root:
```env
# API Configuration
IDP_BASE_URL=https://idp.payez.net
CLIENT_ID=payez-mobile-client

# Optional: Development overrides
DEV_API_URL=http://localhost:3000
ENABLE_MOCKING=false
```

---

## Running the Application

### iOS Simulator

1. **Start Metro bundler:**
```bash
npm start
# or
npx react-native start
```

2. **In a new terminal, run iOS app:**
```bash
npm run ios
# or
npx react-native run-ios
```

3. **Specify device (optional):**
```bash
npx react-native run-ios --simulator="iPhone 14 Pro"
```

### Android Emulator

1. **Start Android emulator:**
   - Open Android Studio
   - Click AVD Manager
   - Start an emulator

2. **Start Metro bundler:**
```bash
npm start
```

3. **In a new terminal, run Android app:**
```bash
npm run android
# or
npx react-native run-android
```

### Physical Device

#### iOS Device
1. Connect device via USB
2. Open `ios/PayEzReactNativeMVP.xcworkspace` in Xcode
3. Select your device from the device list
4. Click Run button

#### Android Device
1. Enable Developer Options and USB Debugging on device
2. Connect device via USB
3. Verify connection:
```bash
adb devices
```
4. Run the app:
```bash
npx react-native run-android
```

---

## Common Setup Issues

### iOS Issues

**Pod installation fails:**
```bash
cd ios
pod deintegrate
pod install
```

**Build fails with "No bundle URL present":**
```bash
npx react-native start --reset-cache
```

### Android Issues

**Gradle build fails:**
```bash
cd android
./gradlew clean
cd ..
npx react-native run-android
```

**Metro bundler connection issues:**
- Shake device or press Cmd+D (iOS) / Cmd+M (Android)
- Go to Dev Settings → Debug server host
- Enter: `localhost:8081` or `[YOUR_IP]:8081`

**JAVA_HOME not set:**
```bash
export JAVA_HOME=$(/usr/libexec/java_home -v 11)
```

---

## VS Code Setup (Recommended)

### Extensions
- React Native Tools
- TypeScript React code snippets
- ESLint
- Prettier - Code formatter

### Debug Configuration

Create `.vscode/launch.json`:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug iOS",
      "type": "reactnative",
      "request": "launch",
      "platform": "ios"
    },
    {
      "name": "Debug Android",
      "type": "reactnative",
      "request": "launch",
      "platform": "android"
    }
  ]
}
```

---

## Testing Setup

### Unit Tests
```bash
npm test
```

### E2E Tests (Detox - TODO)
```bash
# iOS
npm run e2e:ios

# Android
npm run e2e:android
```

---

## Deployment Preparation

### iOS
1. Configure signing certificates in Xcode
2. Update bundle identifier
3. Configure App Store Connect

### Android
1. Generate signed APK:
```bash
cd android
./gradlew assembleRelease
```

2. Configure Google Play Console

---

## Additional Resources

- [React Native Docs](https://reactnative.dev/docs/getting-started)
- [React Navigation](https://reactnavigation.org/)
- [Zustand Documentation](https://github.com/pmndrs/zustand)
- [Azure DevOps](https://dev.azure.com/payez)

---

## Support Contacts

- **Technical Issues**: Contact DevOps team
- **Auth/API Questions**: Review PayEz-Next-MVP docs
- **React Native Help**: Check #mobile-dev Slack channel