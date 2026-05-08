exports.up = async (knex) => {
  await knex.schema.createTable('cwv_history', (t) => {
    t.increments('id')
    t.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    t.text('url').notNullable()
    t.float('lcp_ms').nullable()        // Largest Contentful Paint (ms)
    t.float('tbt_ms').nullable()        // Total Blocking Time (ms)
    t.float('cls').nullable()           // Cumulative Layout Shift (unitless)
    t.integer('performance_score').nullable()  // PSI overall score 0-100
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now())
  })
  await knex.raw('CREATE INDEX ON cwv_history(user_id, url, created_at)')
}

exports.down = (knex) => knex.schema.dropTable('cwv_history')
