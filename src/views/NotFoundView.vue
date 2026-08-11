<script setup lang="ts">
import { RouterLink } from 'vue-router';
</script>

<template>
  <section class="page" aria-labelledby="not-found-title">
    <article class="form-card">
      <p class="eyebrow">Страница не найдена</p>
      <h1 id="not-found-title">Такой страницы нет</h1>
      <RouterLink class="primary-button" to="/">Перейти к «Сегодня»</RouterLink>
    </article>
  </section>
</template>
