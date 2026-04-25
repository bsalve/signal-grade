'use strict';

exports.up = async function (knex) {
  await knex.schema.table('users', (t) => {
    t.string('plan', 20).notNullable().defaultTo('free'); // 'free' | 'pro' | 'agency'
    t.string('stripe_customer_id', 255).nullable();
    t.string('stripe_subscription_id', 255).nullable();
    t.string('stripe_subscription_status', 50).nullable(); // 'active' | 'canceled' | 'past_due' etc.
  });
};

exports.down = async function (knex) {
  await knex.schema.table('users', (t) => {
    t.dropColumn('plan');
    t.dropColumn('stripe_customer_id');
    t.dropColumn('stripe_subscription_id');
    t.dropColumn('stripe_subscription_status');
  });
};
