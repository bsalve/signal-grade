exports.up = knex => knex.schema.createTable('api_usage_log', t => {
  t.increments('id')
  t.integer('key_id').notNullable().references('id').inTable('api_keys').onDelete('CASCADE')
  t.string('endpoint', 200).notNullable()
  t.integer('status_code').notNullable().defaultTo(200)
  t.timestamp('ts').notNullable().defaultTo(knex.fn.now())
})

exports.down = knex => knex.schema.dropTable('api_usage_log')
