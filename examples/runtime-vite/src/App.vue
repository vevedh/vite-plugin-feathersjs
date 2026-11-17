<script setup lang="ts">
import { onMounted, ref } from 'vue'

const message = ref('Vérification…')

function isHealth(value: unknown): value is { status: 'ok' } {
  return typeof value === 'object' && value !== null && 'status' in value && value.status === 'ok'
}

onMounted(async () => {
  try {
    const response = await fetch('/api/health/status', { headers: { Accept: 'application/json' } })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const payload: unknown = await response.json()
    if (!isHealth(payload)) throw new Error('Invalid API response')
    message.value = 'REST Feathers opérationnel via Vite (/api/health/status)'
  } catch {
    message.value = 'Le serveur REST ne répond pas correctement.'
  }
})
</script>

<template>
  <main style="font-family: sans-serif; max-width: 680px; margin: 4rem auto">
    <h1>Vite + Feathers intégré</h1>
    <p role="status">{{ message }}</p>
  </main>
</template>
