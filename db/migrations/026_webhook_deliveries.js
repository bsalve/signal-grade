exports.up = knex => knex.schema.createTable('webhook_deliveries', t => {
  t.increments('id')
  t.integer('webhook_id').notNullable().references('id').inTable('webhooks').onDelete('CASCADE')
  t.string('event', 100).notNullable()
  t.integer('status_code')
  t.text('response_snippet')
  t.timestamp('attempted_at').notNullable().defaultTo(knex.fn.now())
})

exports.down = knex => knex.schema.dropTable('webhook_deliveries')
