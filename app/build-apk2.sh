#!/bin/bash
TC=$HOME/workspace/la-asistenta/app/toolchain
export JAVA_HOME=$TC/jdk
export ANDROID_HOME=$TC/android-sdk
export ANDROID_SDK_ROOT=$TC/android-sdk
export GRADLE_USER_HOME=$TC/gradle-home
cd $TC/dl
if [ ! -f gradle-8.14.3-bin.zip ]; then curl -sSL -o gradle-8.14.3-bin.zip "https://services.gradle.org/distributions/gradle-8.14.3-bin.zip"; fi
ls -la gradle-8.14.3-bin.zip
if [ ! -d $TC/gradle-8.14.3 ]; then unzip -q gradle-8.14.3-bin.zip -d $TC; fi
cd $HOME/workspace/la-asistenta/app/android
$TC/gradle-8.14.3/bin/gradle assembleDebug --no-daemon
echo "BUILD_EXIT=$?"
ls -la app/build/outputs/apk/debug/ 2>/dev/null
