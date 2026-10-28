#!/bin/bash
TC=$HOME/workspace/la-asistenta/app/toolchain
export JAVA_HOME=$TC/jdk
export ANDROID_HOME=$TC/android-sdk
export ANDROID_SDK_ROOT=$TC/android-sdk
export GRADLE_USER_HOME=$TC/gradle-home
cd $HOME/workspace/la-asistenta/app
npx cap sync android
cd android
./gradlew assembleDebug --no-daemon -q
echo "BUILD_EXIT=$?"
ls -la app/build/outputs/apk/debug/ 2>/dev/null
