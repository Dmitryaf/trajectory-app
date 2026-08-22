<script setup lang="ts">
import { formatDate } from '../../../services/dates';
import type { DecisionFollowUp } from '../decisionFollowUp';

defineProps<{ followUp: DecisionFollowUp }>();
</script>

<template>
  <article class="dashboard-card decision-follow-up" aria-labelledby="decision-follow-up-title">
    <div class="section-heading">
      <div>
        <span class="eyebrow">Две последовательные недели</span>
        <h2 id="decision-follow-up-title">Решение и что было дальше</h2>
      </div>
    </div>

    <div class="decision-follow-up__step">
      <span>1</span>
      <div>
        <small>Решение прошлого обзора</small>
        <p v-if="followUp.decision">{{ followUp.decision }}</p>
        <p v-if="followUp.ifThenPlan"><strong>Если — то:</strong> {{ followUp.ifThenPlan }}</p>
      </div>
    </div>

    <div class="decision-follow-up__step">
      <span>2</span>
      <div>
        <small>Что было записано на следующей неделе</small>
        <ul v-if="followUp.facts.length">
          <li v-for="fact in followUp.facts" :key="fact.id">
            <time>{{ formatDate(fact.date, { day: 'numeric', month: 'short' }) }}</time>
            <strong>{{ fact.label }}</strong>
            <p>{{ fact.text }}</p>
          </li>
        </ul>
        <p v-else class="decision-follow-up__missing">Отдельных итогов, событий или важных условий за неделю не сохранено.</p>
        <p class="data-note">Это записи, которые шли после решения. Они сами по себе не доказывают причину.</p>
      </div>
    </div>

    <div class="decision-follow-up__step decision-follow-up__step--outcome">
      <span>3</span>
      <div>
        <small>Проверка пользователя</small>
        <p>{{ followUp.userOutcome }}</p>
      </div>
    </div>

    <div class="decision-follow-up__step">
      <span>4</span>
      <div>
        <small>Следующее решение</small>
        <p v-if="followUp.nextDecision">{{ followUp.nextDecision }}</p>
        <p v-if="followUp.nextIfThenPlan"><strong>Если — то:</strong> {{ followUp.nextIfThenPlan }}</p>
        <p v-if="!followUp.nextDecision && !followUp.nextIfThenPlan" class="decision-follow-up__missing">
          Следующее решение пока не сохранено.
        </p>
      </div>
    </div>
  </article>
</template>
