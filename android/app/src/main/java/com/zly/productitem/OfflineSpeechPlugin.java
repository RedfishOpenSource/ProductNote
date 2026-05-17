package com.zly.productitem;

import android.Manifest;
import android.content.Intent;
import android.os.Bundle;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.ArrayList;
import java.util.Locale;

@CapacitorPlugin(
    name = "OfflineSpeech",
    permissions = {
        @Permission(strings = { Manifest.permission.RECORD_AUDIO }, alias = "audio")
    }
)
public class OfflineSpeechPlugin extends Plugin {
    private static final String DEFAULT_PROMPT = "请说出商品信息";
    private static final String DEFAULT_LANGUAGE = Locale.SIMPLIFIED_CHINESE.toLanguageTag();
    private static final int MAX_RECOGNITION_RESULTS = 5;

    private SpeechRecognizer speechRecognizer;
    private PluginCall recognitionCall;

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject result = new JSObject();
        result.put("available", SpeechRecognizer.isRecognitionAvailable(getContext()));
        call.resolve(result);
    }

    @PluginMethod
    public void recognize(PluginCall call) {
        if (!SpeechRecognizer.isRecognitionAvailable(getContext())) {
            call.unavailable("当前设备不支持系统语音识别");
            return;
        }

        if (recognitionCall != null) {
            call.reject("语音识别正在进行中");
            return;
        }

        if (getPermissionState("audio") != PermissionState.GRANTED) {
            requestPermissionForAlias("audio", call, "audioPermissionCallback");
            return;
        }

        startRecognition(call);
    }

    @PermissionCallback
    private void audioPermissionCallback(PluginCall call) {
        if (getPermissionState("audio") != PermissionState.GRANTED) {
            call.reject("需要麦克风权限才能进行语音录入");
            return;
        }

        startRecognition(call);
    }

    @Override
    protected void handleOnDestroy() {
        cleanupRecognizer();
        super.handleOnDestroy();
    }

    private void startRecognition(PluginCall call) {
        cleanupRecognizer();

        speechRecognizer = SpeechRecognizer.createSpeechRecognizer(getContext());
        recognitionCall = call;
        call.setKeepAlive(true);
        saveCall(call);

        speechRecognizer.setRecognitionListener(new RecognitionListener() {
            @Override
            public void onReadyForSpeech(Bundle params) {}

            @Override
            public void onBeginningOfSpeech() {}

            @Override
            public void onRmsChanged(float rmsdB) {}

            @Override
            public void onBufferReceived(byte[] buffer) {}

            @Override
            public void onEndOfSpeech() {}

            @Override
            public void onPartialResults(Bundle partialResults) {}

            @Override
            public void onEvent(int eventType, Bundle params) {}

            @Override
            public void onResults(Bundle results) {
                PluginCall activeCall = recognitionCall;
                if (activeCall == null) {
                    cleanupRecognizer();
                    return;
                }

                ArrayList<String> matches = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                if (matches == null || matches.isEmpty()) {
                    rejectRecognition("没有识别到语音内容");
                    return;
                }

                JSArray alternatives = new JSArray();
                for (String match : matches) {
                    alternatives.put(match);
                }

                JSObject result = new JSObject();
                result.put("text", matches.get(0));
                result.put("alternatives", alternatives);
                activeCall.resolve(result);
                releaseRecognitionCall(activeCall);
                cleanupRecognizer();
            }

            @Override
            public void onError(int error) {
                rejectRecognition(mapRecognitionError(error));
            }
        });

        speechRecognizer.startListening(buildRecognitionIntent(call));
    }

    private void rejectRecognition(String message) {
        PluginCall activeCall = recognitionCall;
        if (activeCall != null) {
            activeCall.reject(message);
            releaseRecognitionCall(activeCall);
        }
        cleanupRecognizer();
    }

    private void releaseRecognitionCall(PluginCall call) {
        recognitionCall = null;
        call.release(bridge);
    }

    private void cleanupRecognizer() {
        if (speechRecognizer != null) {
            speechRecognizer.cancel();
            speechRecognizer.destroy();
            speechRecognizer = null;
        }
    }

    private Intent buildRecognitionIntent(PluginCall call) {
        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, call.getString("language", DEFAULT_LANGUAGE));
        intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, MAX_RECOGNITION_RESULTS);
        intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false);
        intent.putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, call.getBoolean("preferOffline", true));

        String prompt = call.getString("prompt", DEFAULT_PROMPT);
        if (prompt != null && !prompt.isEmpty()) {
            intent.putExtra(RecognizerIntent.EXTRA_PROMPT, prompt);
        }

        return intent;
    }

    private String mapRecognitionError(int error) {
        switch (error) {
            case SpeechRecognizer.ERROR_AUDIO:
                return "录音失败，请重试";
            case SpeechRecognizer.ERROR_CLIENT:
                return "语音识别已取消";
            case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS:
                return "缺少麦克风权限";
            case SpeechRecognizer.ERROR_LANGUAGE_NOT_SUPPORTED:
            case SpeechRecognizer.ERROR_LANGUAGE_UNAVAILABLE:
                return "设备未安装中文离线语音包，请先在系统设置中下载";
            case SpeechRecognizer.ERROR_NETWORK:
            case SpeechRecognizer.ERROR_NETWORK_TIMEOUT:
            case SpeechRecognizer.ERROR_SERVER:
                return "离线语音识别不可用，请先安装系统离线语音包";
            case SpeechRecognizer.ERROR_NO_MATCH:
            case SpeechRecognizer.ERROR_SPEECH_TIMEOUT:
                return "没有听清，请再说一遍";
            case SpeechRecognizer.ERROR_RECOGNIZER_BUSY:
                return "语音识别正忙，请稍后再试";
            default:
                return "语音识别失败，请稍后重试";
        }
    }
}
