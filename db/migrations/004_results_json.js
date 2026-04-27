exports.up = (knex) => knex.schema.alterTable('reports', t => t.jsonb('results_json').nullable())
exports.down = (knex) => knex.schema.alterTable('reports', t => t.dropColumn('results_json'))
