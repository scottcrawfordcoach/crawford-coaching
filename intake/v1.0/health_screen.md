# Synergize Fitness — Health Screen (v1.0)

> Human-readable legal record. The authoritative, hash-source copy is
> [`documents.js`](documents.js) (`canonicalText('health_screen')`). Keep this
> file in sync with that module; never edit one without the other.

A few questions so we can coach you safely and adapt where you need it. Nothing
here is a barrier to training — it just helps us understand you.

## Your details

Name, email (pre-filled from your member account, editable), age, sex, height.

## Part A — Activity Readiness (yes / no each)

1. Has a doctor ever told you that you have a heart condition, or that you should only do physical activity under medical supervision?
2. Do you experience chest pain when you are physically active?
3. In the past month, have you had chest pain when you were not being physically active?
4. Do you ever feel faint, lose your balance from dizziness, or lose consciousness?
5. Do you have a bone or joint problem that could be worsened by exercise?
6. Are you currently taking any medication prescribed for blood pressure or a heart condition?
7. Are you aware of any other reason you should not take part in physical activity?

**If you answered "yes" to any of the above:** we ask that you speak with your
doctor before beginning, and let your coach know. This isn't a barrier to
training — it just helps us coach you safely and adapt where needed.

*(Any "yes" sets `flagged = true` on the record; a flagged screen needs the
coach's review before the member is cleared to train.)*

## Part B — Health History (each yes / no)

High / low blood pressure · History of heart disease · Heart disease · Diabetes ·
Asthma · Weight concerns · Osteoporosis · Arthritis · Fibromyalgia · Pregnancy ·
Depression · Other (describe).

## Part C — Injury Screen (per area: none / acute / chronic)

Neck · Shoulder L/R · Hip L/R · Knee L/R · Ankle L/R · Lower back · Other.

## Part D — You & your goals (free text)

- What does your current activity or training look like?
- What can I do to help you? What are your fitness & health goals?
- Anything else you'd like to add or ask?

**Renewal:** health screens expire 12 months after signing (`expires_at =
signed_at + 12 months`); an expired screen counts as not-current for gating.
