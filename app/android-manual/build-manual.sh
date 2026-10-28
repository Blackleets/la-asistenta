#!/bin/bash
# Build manual del APK de La Asistenta SIN Gradle (el sandbox bloquea el
# socket cliente↔daemon de Gradle: permiso other_tcp en Deny).
# Cadena: aapt2 → javac → d8 → zipalign → apksigner. Reproducible.
set -e
TC=$HOME/workspace/la-asistenta/app/toolchain
export JAVA_HOME=$TC/jdk
export PATH=$JAVA_HOME/bin:$PATH
BT=$TC/android-sdk/build-tools/36.0.0
JAR=$TC/android-sdk/platforms/android-36/android.jar
ROOT=$HOME/workspace/la-asistenta/app
M=$ROOT/android-manual
OUT=$ROOT/dist
WORK=$M/build
rm -rf $WORK && mkdir -p $WORK/classes $OUT

echo "== 1/6 aapt2: compilar recursos =="
$BT/aapt2 compile --dir $M/res -o $WORK/res.zip

echo "== 2/6 aapt2: link (APK sin firmar, con assets de www/) =="
$BT/aapt2 link -o $WORK/unsigned.apk -I $JAR \
  --manifest $M/AndroidManifest.xml \
  -A $ROOT/www \
  --min-sdk-version 26 --target-sdk-version 35 \
  $WORK/res.zip

echo "== 3/6 javac: código de la app =="
$JAVA_HOME/bin/javac -source 11 -target 11 -cp $JAR -d $WORK/classes \
  $M/src/es/arivivas/asistenta/MainActivity.java

echo "== 4/6 d8: dex =="
$BT/d8 --lib $JAR --min-api 26 --output $WORK \
  $(find $WORK/classes -name '*.class')

echo "== 5/6 meter el dex y alinear =="
cd $WORK && zip -q unsigned.apk classes.dex
$BT/zipalign -f 4 $WORK/unsigned.apk $WORK/aligned.apk

echo "== 6/6 firmar (clave debug propia) y verificar =="
KS=$M/debug.keystore
if [ ! -f $KS ]; then
  $JAVA_HOME/bin/keytool -genkeypair -keystore $KS -storepass android -keypass android \
    -alias asistenta -keyalg RSA -keysize 2048 -validity 10950 \
    -dname "CN=La Asistenta (debug), O=Ari Vivas Beauty, C=ES" > /dev/null 2>&1
fi
$BT/apksigner sign --ks $KS --ks-pass pass:android --key-pass pass:android \
  --out $OUT/la-asistenta.apk $WORK/aligned.apk
$BT/apksigner verify --verbose $OUT/la-asistenta.apk | head -4
echo "APK LISTO:"
ls -la $OUT/la-asistenta.apk
$BT/aapt2 dump badging $OUT/la-asistenta.apk | head -4
