<script setup lang="ts">
import { ref } from 'vue';
import { createWorker } from 'tesseract.js';

export interface Props {
  onTextExtracted: (text: string) => void;
  isLoading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  isLoading: false,
});

const emit = defineEmits<{
  textExtracted: [text: string];
  error: [error: string];
}>();

const isScanning = ref(false);
const scanProgress = ref(0);
const scanStatus = ref('');
const fileInput = ref<HTMLInputElement>();
const previewImage = ref('');
const extractedText = ref('');
const dragActive = ref(false);

/**
 * Process image and extract text using Tesseract.js
 */
async function processImage(file: File) {
  if (!file.type.startsWith('image/')) {
    emit('error', 'Please select an image file');
    return;
  }

  isScanning.value = true;
  scanProgress.value = 0;
  scanStatus.value = 'Initializing OCR...';

  try {
    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      previewImage.value = e.target?.result as string;
    };
    reader.readAsDataURL(file);

    // Create Tesseract worker
    const worker = await createWorker('eng', 1, {
      logger: (message) => {
        if (message.status === 'recognizing') {
          scanProgress.value = Math.round(message.progress * 100);
          scanStatus.value = `Scanning: ${scanProgress.value}%`;
        }
      },
    });

    // Read file as data URL for processing
    const imageUrl = previewImage.value || URL.createObjectURL(file);

    // Perform OCR
    const result = await worker.recognize(imageUrl);
    extractedText.value = result.data.text;

    // Notify parent component
    emit('textExtracted', result.data.text);
    props.onTextExtracted(result.data.text);

    scanStatus.value = 'Text extraction complete!';

    // Clean up
    await worker.terminate();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to process image';
    emit('error', errorMessage);
    scanStatus.value = `Error: ${errorMessage}`;
  } finally {
    isScanning.value = false;
  }
}

/**
 * Handle file selection
 */
function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) {
    processImage(file);
  }
}

/**
 * Handle drag and drop
 */
function handleDragOver(event: DragEvent) {
  event.preventDefault();
  dragActive.value = true;
}

function handleDragLeave() {
  dragActive.value = false;
}

function handleDrop(event: DragEvent) {
  event.preventDefault();
  dragActive.value = false;

  const file = event.dataTransfer?.files?.[0];
  if (file) {
    processImage(file);
  }
}

/**
 * Trigger file input
 */
function triggerFileSelect() {
  fileInput.value?.click();
}

/**
 * Copy extracted text to clipboard
 */
function copyToClipboard() {
  navigator.clipboard.writeText(extractedText.value);
}

/**
 * Clear the scanner
 */
function clearScanner() {
  extractedText.value = '';
  previewImage.value = '';
  scanProgress.value = 0;
  scanStatus.value = '';
  if (fileInput.value) {
    fileInput.value.value = '';
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- File Input (Hidden) -->
    <input
      ref="fileInput"
      type="file"
      accept="image/*"
      class="hidden"
      @change="handleFileSelect"
    />

    <!-- Drag & Drop Zone -->
    <div
      :class="[
        'relative rounded-xl border-2 border-dashed transition-all duration-200 p-8 text-center',
        dragActive
          ? 'border-accent bg-accent-soft'
          : 'border-line-soft bg-paper hover:border-line hover:bg-ink-faint/5',
      ]"
      @dragover="handleDragOver"
      @dragleave="handleDragLeave"
      @drop="handleDrop"
    >
      <div class="space-y-3">
        <!-- Icon -->
        <div class="flex justify-center">
          <div
            class="inline-flex h-12 w-12 items-center justify-center rounded-full"
            :class="dragActive ? 'bg-accent text-white' : 'bg-accent-soft text-accent'"
          >
            <svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
        </div>

        <!-- Text -->
        <div>
          <p class="font-semibold text-ink">
            {{ isScanning ? 'Scanning...' : 'Drag & drop image here' }}
          </p>
          <p class="text-sm text-ink-faint">or</p>
          <button
            type="button"
            :disabled="isScanning"
            class="mt-2 font-medium text-accent hover:text-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
            @click="triggerFileSelect"
          >
            Click to select
          </button>
        </div>

        <!-- Supported formats -->
        <p class="text-xs text-ink-faint">
          Supported: PNG, JPG, JPEG, GIF, WebP
        </p>
      </div>

      <!-- Progress Bar -->
      <div v-if="isScanning && scanProgress > 0" class="mt-6 space-y-2">
        <div class="h-2 w-full overflow-hidden rounded-full bg-line-soft">
          <div
            class="h-full bg-accent transition-all duration-300"
            :style="{ width: `${scanProgress}%` }"
          />
        </div>
        <p class="text-xs text-ink-faint">{{ scanStatus }}</p>
      </div>
    </div>

    <!-- Image Preview -->
    <div v-if="previewImage" class="rounded-lg overflow-hidden bg-paper border border-line-soft">
      <img
        :src="previewImage"
        alt="Preview"
        class="w-full h-auto object-contain max-h-64"
      />
    </div>

    <!-- Extracted Text -->
    <div v-if="extractedText" class="space-y-3">
      <div class="flex items-center justify-between gap-3">
        <h3 class="font-semibold text-ink">Extracted Text</h3>
        <div class="flex gap-2">
          <button
            type="button"
            @click="copyToClipboard"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-ink rounded-lg hover:bg-ink-faint/10 transition-colors"
            title="Copy to clipboard"
          >
            <svg class="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="3" y="3" width="12" height="12" rx="1" />
              <path d="M7 17a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2" />
            </svg>
            Copy
          </button>
          <button
            type="button"
            @click="clearScanner"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-ink-faint hover:text-ink rounded-lg hover:bg-ink-faint/10 transition-colors"
            title="Clear"
          >
            <svg class="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M6 4h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2m3 4v6m4-6v6" />
            </svg>
            Clear
          </button>
        </div>
      </div>

      <div class="rounded-lg bg-ink-faint/5 p-4 font-mono text-sm text-ink whitespace-pre-wrap break-words max-h-48 overflow-y-auto">
        {{ extractedText }}
      </div>
    </div>

    <!-- Error State -->
    <div v-if="scanStatus.includes('Error')" class="rounded-lg bg-error-soft p-4 text-error-dark">
      <p class="text-sm font-medium">{{ scanStatus }}</p>
    </div>
  </div>
</template>

<style scoped>
/* Smooth transitions */
:deep(*) {
  transition-property: background-color, border-color, color;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 200ms;
}
</style>
