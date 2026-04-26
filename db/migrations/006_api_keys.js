exports.up = (knex) => knex.schema.createTable('api_keys', (t) => {
  t.increments('id')
  t.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
  t.string('key_hash', 64).notNullable().unique()
  t.string('label', 100).notNullable().defaultTo('')
  t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now())
  t.timestamp('last_used_at', { useTz: true }).nullable()
})

exports.down = (knex) => knex.schema.dropTable('api_keys')
