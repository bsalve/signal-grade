exports.up = async (knex) => {
  await knex.schema.createTable('ai_visibility_scans', (t) => {
    t.increments('id')
    t.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    t.text('domain').notNullable()
    t.text('platform').notNullable()       // 'gemini' | 'groq'
    t.text('query').notNullable()
    t.boolean('mentioned').notNullable()
    t.text('sentiment').nullable()         // 'positive' | 'neutral' | 'negative'
    t.text('excerpt').nullable()
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now())
  })
  await knex.raw('CREATE INDEX ON ai_visibility_scans(user_id, domain, created_at)')
}

exports.down = (knex) => knex.schema.dropTable('ai_visibility_scans')
