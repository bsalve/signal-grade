'use strict';

exports.up = async function (knex) {
  await knex.schema.alterTable('reports', (t) => {
    t.text('r2_key').nullable();
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('reports', (t) => {
    t.dropColumn('r2_key');
  });
};
