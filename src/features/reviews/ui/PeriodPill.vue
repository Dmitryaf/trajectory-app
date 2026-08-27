<template>
  <span class="period-pill"><slot></slot></span>
</template>

<style scoped>
.period-pill {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
  padding: 7px 11px;
  border: 1px solid #cce4da;
  border-radius: 999px;
  background: #e4f5ee;
  color: #26654f;
  font-size: 12px;
  font-weight: 800;
  white-space: nowrap;
}
</style>
