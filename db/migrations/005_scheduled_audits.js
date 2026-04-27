exports.up = (knex) => knex.schema.createTable('scheduled_audits', (t) => {
  t.increments('id')
  t.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
  t.text('url').notNullable()
  t.string('frequency', 10).notNullable() // 'weekly' | 'monthly'
  t.boolean('enabled').notNullable().defaultTo(true)
  t.timestamp('next_run_at', { useTz: true }).nullable()
  t.timestamp('last_run_at', { useTz: true }).nullable()
  t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now())
})

exports.down = (knex) => knex.schema.dropTable('scheduled_audits')
