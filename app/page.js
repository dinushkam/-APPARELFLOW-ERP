'use client';

import { useEffect, useMemo, useState } from 'react';

const DEMOS = [
  {
    label: 'Cutting Supervisor',
    short: 'Supervisor',
    role: 'cutting_supervisor',
    email: 'supervisor@apparelflow.demo',
    password: 'Supervisor123!'
  },
  {
    label: 'Cutting Verifier',
    short: 'Verifier',
    role: 'cutting_verifier',
    email: 'verifier@apparelflow.demo',
    password: 'Verifier123!'
  },
  {
    label: 'Sewing Supervisor',
    short: 'Sewing',
    role: 'sewing_supervisor',
    email: 'sewing@apparelflow.demo',
    password: 'Sewing123!'
  }
];

const ROLE_META = {
  cutting_supervisor: {
    title: 'Cutting Operations',
    label: 'Cutting Supervisor',
    subtitle:
      'Create production batches, track cutting progress and resubmit rejected work.'
  },
  cutting_verifier: {
    title: 'Quality Verification',
    label: 'Cutting Verifier',
    subtitle:
      'Verify component counts and release only complete batches to the sewing floor.'
  },
  sewing_supervisor: {
    title: 'Sewing Queue',
    label: 'Sewing Supervisor',
    subtitle:
      'Review verified production batches and begin assembly operations.'
  }
};

async function api(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }

  return data;
}

function Icon({ name, size = 18 }) {
  const paths = {
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </>
    ),
    layers: (
      <>
        <path d="m12 2 9 5-9 5-9-5 9-5Z" />
        <path d="m3 12 9 5 9-5" />
        <path d="m3 17 9 5 9-5" />
      </>
    ),
    shield: (
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
    ),
    logout: (
      <>
        <path d="M10 17l5-5-5-5" />
        <path d="M15 12H3" />
        <path d="M21 19V5a2 2 0 0 0-2-2h-6" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 22a8 8 0 0 1 16 0" />
      </>
    ),
    plus: (
      <>
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </>
    ),
    box: (
      <>
        <path d="M21 8 12 3 3 8l9 5 9-5Z" />
        <path d="M3 8v8l9 5 9-5V8" />
        <path d="M12 13v8" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    alert: (
      <>
        <path d="M10.3 2.9 1.8 17a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 2.9a2 2 0 0 0-3.4 0Z" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
      </>
    ),
    factory: (
      <>
        <path d="M3 21V9l6 3V9l6 3V4h6v17H3Z" />
        <path d="M7 17h2" />
        <path d="M13 17h2" />
        <path d="M18 8h3" />
      </>
    ),
    arrow: (
      <>
        <path d="M5 12h14" />
        <path d="m13 6 6 6-6 6" />
      </>
    ),
    refresh: (
      <>
        <path d="M20 6v6h-6" />
        <path d="M4 18v-6h6" />
        <path d="M18.5 9a7 7 0 0 0-12-2L4 12" />
        <path d="M5.5 15a7 7 0 0 0 12 2l2.5-5" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    )
  };

  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || paths.grid}
    </svg>
  );
}

function Badge({ children, tone = 'neutral' }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

function StatusBadge({ status }) {
  const tone =
    status === 'VERIFIED' || status === 'SEWING'
      ? 'success'
      : status === 'REJECTED'
      ? 'danger'
      : 'warning';

  const label = String(status || '').replaceAll('_', ' ');

  return <Badge tone={tone}>{label}</Badge>;
}

function EmptyState({ title, text }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Icon name="box" size={22} />
      </div>
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
}

export default function Home() {
  const [user, setUser] = useState(null);
  const [recipes, setRecipes] = useState([]);
  const [orders, setOrders] = useState([]);
  const [queue, setQueue] = useState([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [credentials, setCredentials] = useState({
    email: '',
    password: ''
  });

  async function refresh() {
    if (!user) return;

    const [recipeData, orderData] = await Promise.all([
      api('/api/recipes'),
      api('/api/orders')
    ]);

    setRecipes(recipeData.recipes || []);
    setOrders(orderData.orders || []);

    if (user.role === 'sewing_supervisor') {
      const queueData = await api('/api/sewing/queue');
      setQueue(queueData.queue || []);
    } else {
      setQueue([]);
    }
  }

  useEffect(() => {
    api('/api/auth/me')
      .then(data => setUser(data.user))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (user) {
      refresh().catch(error => setMessage(error.message));
    }
  }, [user]);

  async function login(credentialsToUse) {
    setBusy(true);
    setMessage('');

    try {
      const data = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentialsToUse)
      });

      setUser(data.user);
      setCredentials({
        email: '',
        password: ''
      });
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function submitLogin(event) {
    event.preventDefault();
    await login(credentials);
  }

  function useDemo(demo) {
    setCredentials({
      email: demo.email,
      password: demo.password
    });

    setMessage('');
  }

  async function logout() {
    try {
      await api('/api/auth/logout', {
        method: 'POST'
      });
    } finally {
      setUser(null);
      setOrders([]);
      setRecipes([]);
      setQueue([]);
      setMessage('');
    }
  }

  if (!user) {
    return (
      <main className="auth-page">
        <section className="auth-brand">
          <div className="brand-lockup">
            <div className="brand-mark">
              <span>AF</span>
            </div>

            <div>
              <strong>ApparelFlow</strong>
              <span>Manufacturing ERP</span>
            </div>
          </div>

          <div className="auth-copy">
            <span className="overline">Production control</span>

            <h1>
              From cutting floor to sewing line, with every batch accounted for.
            </h1>

            <p>
              Production batch verification, component-level quality control
              and controlled sewing release in one operational workspace.
            </p>

            <div className="auth-features">
              <div>
                <Icon name="layers" />
                <span>Recipe-driven component counts</span>
              </div>

              <div>
                <Icon name="shield" />
                <span>Role-based production controls</span>
              </div>

              <div>
                <Icon name="check" />
                <span>Verified-only sewing handoff</span>
              </div>
            </div>
          </div>

          <div className="auth-brand-footer">
            Webtezza · ApparelFlow ERP
          </div>
        </section>

        <section className="auth-panel">
          <div className="auth-panel-inner">
            <div className="auth-heading">
              <span className="overline">Factory access</span>
              <h2>Welcome back</h2>
              <p>Sign in with your assigned production account.</p>
            </div>

            {message && (
              <div className="notice error">
                <Icon name="alert" />
                <span>{message}</span>
              </div>
            )}

            <form className="login-form" onSubmit={submitLogin}>
              <label className="field">
                <span>Email address</span>

                <input
                  type="email"
                  autoComplete="username"
                  required
                  value={credentials.email}
                  onChange={event =>
                    setCredentials({
                      ...credentials,
                      email: event.target.value
                    })
                  }
                  placeholder="name@apparelflow.demo"
                />
              </label>

              <label className="field">
                <span>Password</span>

                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  value={credentials.password}
                  onChange={event =>
                    setCredentials({
                      ...credentials,
                      password: event.target.value
                    })
                  }
                  placeholder="Enter your password"
                />
              </label>

              <button
                className="btn primary wide"
                type="submit"
                disabled={busy}
              >
                {busy ? 'Signing in…' : 'Sign in'}

                {!busy && <Icon name="arrow" size={17} />}
              </button>
            </form>

            <div className="demo-section">
              <div className="section-divider">
                <span>Demo access</span>
              </div>

              <p className="demo-help">
                Choose a seeded account to fill the sign-in form.
              </p>

              <div className="demo-list">
                {DEMOS.map(demo => (
                  <button
                    type="button"
                    className="demo-user"
                    key={demo.role}
                    onClick={() => useDemo(demo)}
                    disabled={busy}
                  >
                    <span className="demo-avatar">
                      {demo.short.charAt(0)}
                    </span>

                    <span className="demo-user-copy">
                      <strong>{demo.label}</strong>
                      <small>{demo.email}</small>
                    </span>

                    <Icon name="arrow" size={16} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
    );
  }

  const meta =
    ROLE_META[user.role] || ROLE_META.cutting_supervisor;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark small">
            <span>AF</span>
          </div>

          <div>
            <strong>ApparelFlow</strong>
            <span>ERP</span>
          </div>
        </div>

        <nav
          className="sidebar-nav"
          aria-label="Primary navigation"
        >
          <span className="nav-caption">Workspace</span>

          <div className="nav-item active">
            <Icon name="grid" />
            <span>{meta.title}</span>
          </div>

          <div className="nav-item muted">
            <Icon name="layers" />
            <span>Production Control</span>
          </div>

          <div className="nav-item muted">
            <Icon name="shield" />
            <span>Quality Gate</span>
          </div>
        </nav>

        <div className="sidebar-user">
          <div className="user-avatar">
            <Icon name="user" size={17} />
          </div>

          <div className="user-copy">
            <strong>{user.full_name}</strong>
            <span>{meta.label}</span>
          </div>

          <button
            className="icon-button"
            onClick={logout}
            aria-label="Sign out"
            title="Sign out"
          >
            <Icon name="logout" size={18} />
          </button>
        </div>
      </aside>

      <main className="workspace">
        <header className="workspace-header">
          <div>
            <span className="overline">ApparelFlow ERP</span>
            <h1>{meta.title}</h1>
            <p>{meta.subtitle}</p>
          </div>

          <div className="header-actions">
            <div className="session-pill">
              <span className="online-dot" />
              Session active
            </div>

            <button
              className="btn ghost"
              onClick={() =>
                refresh().catch(error =>
                  setMessage(error.message)
                )
              }
            >
              <Icon name="refresh" size={16} />
              Refresh
            </button>
          </div>
        </header>

        {message && (
          <div className="notice">
            <Icon name="check" size={18} />

            <span>{message}</span>

            <button
              onClick={() => setMessage('')}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        )}

        <Dashboard
          user={user}
          recipes={recipes}
          orders={orders}
          queue={queue}
          refresh={refresh}
          setMessage={setMessage}
        />
      </main>
    </div>
  );
}

function Dashboard({
  user,
  recipes,
  orders,
  queue,
  refresh,
  setMessage
}) {
  if (user.role === 'cutting_supervisor') {
    return (
      <Supervisor
        recipes={recipes}
        orders={orders}
        refresh={refresh}
        setMessage={setMessage}
      />
    );
  }

  if (user.role === 'cutting_verifier') {
    return (
      <Verifier
        orders={orders}
        refresh={refresh}
        setMessage={setMessage}
      />
    );
  }

  return (
    <Sewing
      queue={queue}
      refresh={refresh}
      setMessage={setMessage}
    />
  );
}

function Supervisor({
  recipes,
  orders,
  refresh,
  setMessage
}) {
  const [form, setForm] = useState({
    recipe_id: '',
    target_qty: '',
    fabric_roll_id: '',
    actual_fabric_yds: ''
  });

  const selected = recipes.find(
    recipe =>
      String(recipe.id) === String(form.recipe_id)
  );

  const expectedFabric =
    selected && form.target_qty
      ? (
          Number(selected.std_fabric_yards) *
          Number(form.target_qty)
        ).toFixed(2)
      : '—';

  const stats = useMemo(
    () => ({
      total: orders.length,

      pending: orders.filter(
        order => order.status === 'PENDING_VERIFICATION'
      ).length,

      rejected: orders.filter(
        order => order.status === 'REJECTED'
      ).length,

      verified: orders.filter(
        order =>
          order.status === 'VERIFIED' ||
          order.status === 'SEWING'
      ).length
    }),
    [orders]
  );

  async function submit(event) {
    event.preventDefault();
    setMessage('');

    try {
      await api('/api/orders', {
        method: 'POST',
        body: JSON.stringify(form)
      });

      setForm({
        recipe_id: '',
        target_qty: '',
        fabric_roll_id: '',
        actual_fabric_yds: ''
      });

      setMessage(
        'Cutting order created and sent for verification.'
      );

      await refresh();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function resubmit(id) {
    try {
      await api(`/api/orders/${id}/resubmit`, {
        method: 'POST'
      });

      setMessage(
        'Batch returned to the verification queue.'
      );

      await refresh();
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <div className="page-content">
      <section className="stat-grid">
        <StatCard
          label="Total batches"
          value={stats.total}
          hint="All cutting orders"
          icon="layers"
        />

        <StatCard
          label="Awaiting QC"
          value={stats.pending}
          hint="Pending verification"
          icon="clock"
        />

        <StatCard
          label="Rejected"
          value={stats.rejected}
          hint="Needs re-cut"
          icon="alert"
        />

        <StatCard
          label="Released"
          value={stats.verified}
          hint="Verified / sewing"
          icon="check"
        />
      </section>

      <section className="content-grid">
        <form className="panel" onSubmit={submit}>
          <div className="panel-header">
            <div>
              <span className="panel-kicker">
                New batch
              </span>

              <h2>Create cutting order</h2>

              <p>
                Enter the production details before sending
                the batch to QC.
              </p>
            </div>

            <div className="panel-icon">
              <Icon name="plus" />
            </div>
          </div>

          <div className="form-grid">
            <label className="field full">
              <span>Production recipe</span>

              <select
                required
                value={form.recipe_id}
                onChange={event =>
                  setForm({
                    ...form,
                    recipe_id: event.target.value
                  })
                }
              >
                <option value="">
                  Select a recipe
                </option>

                {recipes.map(recipe => (
                  <option
                    key={recipe.id}
                    value={recipe.id}
                  >
                    {recipe.recipe_code} — {recipe.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Target quantity</span>

              <input
                type="number"
                min="1"
                step="1"
                required
                value={form.target_qty}
                onChange={event =>
                  setForm({
                    ...form,
                    target_qty: event.target.value
                  })
                }
                placeholder="50"
              />
            </label>

            <label className="field">
              <span>Fabric roll ID</span>

              <input
                required
                value={form.fabric_roll_id}
                onChange={event =>
                  setForm({
                    ...form,
                    fabric_roll_id: event.target.value
                  })
                }
                placeholder="FAB-ROLL-882"
              />
            </label>

            <label className="field full">
              <span>Actual fabric used (yards)</span>

              <input
                type="number"
                min="0.01"
                step="0.01"
                required
                value={form.actual_fabric_yds}
                onChange={event =>
                  setForm({
                    ...form,
                    actual_fabric_yds:
                      event.target.value
                  })
                }
                placeholder="90.00"
              />
            </label>
          </div>

          <div className="form-summary">
            <span>Expected fabric</span>

            <strong>
              {expectedFabric === '—'
                ? 'Select recipe & quantity'
                : `${expectedFabric} yds`}
            </strong>
          </div>

          <button
            className="btn primary"
            type="submit"
          >
            Submit for verification
            <Icon name="arrow" size={16} />
          </button>
        </form>

        <section className="panel recipe-panel">
          <div className="panel-header">
            <div>
              <span className="panel-kicker">
                Bill of materials
              </span>

              <h2>Component preview</h2>

              <p>
                Expected cut-piece quantities are derived
                from the selected recipe.
              </p>
            </div>

            <div className="panel-icon">
              <Icon name="box" />
            </div>
          </div>

          {!selected ? (
            <EmptyState
              title="No recipe selected"
              text="Choose a production recipe to preview component requirements."
            />
          ) : (
            <>
              <div className="recipe-summary">
                <div>
                  <span>Recipe</span>
                  <strong>{selected.name}</strong>
                </div>

                <div>
                  <span>Standard fabric</span>
                  <strong>
                    {selected.std_fabric_yards} yds
                  </strong>
                </div>

                <div>
                  <span>Wastage cap</span>
                  <strong>
                    {selected.wastage_cap}%
                  </strong>
                </div>
              </div>

              <div className="component-list">
                {selected.components.map(component => (
                  <div
                    className="component-row"
                    key={component.id}
                  >
                    <div>
                      <strong>
                        {component.component_name}
                      </strong>

                      <span>
                        {component.pieces_per_garment} per
                        garment
                      </span>
                    </div>

                    <span className="component-qty">
                      {form.target_qty
                        ? Number(form.target_qty) *
                          component.pieces_per_garment
                        : 0}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      </section>

      <OrderTable
        orders={orders}
        action={order =>
          order.status === 'REJECTED' ? (
            <button
              className="btn compact secondary"
              onClick={() => resubmit(order.id)}
            >
              Re-cut & resubmit
            </button>
          ) : (
            <span className="table-muted">—</span>
          )
        }
      />
    </div>
  );
}

function Verifier({
  orders,
  refresh,
  setMessage
}) {
  const counted = orders.reduce(
    (total, order) =>
      total +
      (order.items || []).filter(
        item =>
          item.actual_qty !== null &&
          item.actual_qty !== undefined
      ).length,
    0
  );

  const shortages = orders.reduce(
    (total, order) =>
      total +
      (order.items || []).filter(
        item => item.status === 'RED'
      ).length,
    0
  );

  return (
    <div className="page-content">
      <section className="stat-grid three">
        <StatCard
          label="Waiting batches"
          value={orders.length}
          hint="At QC station"
          icon="layers"
        />

        <StatCard
          label="Components counted"
          value={counted}
          hint="Recorded this view"
          icon="check"
        />

        <StatCard
          label="Shortages found"
          value={shortages}
          hint="Hard-stop conditions"
          icon="alert"
        />
      </section>

      <section className="info-strip">
        <div>
          <span className="traffic-dot green" />
          <strong>Green</strong>
          <span>Exact match</span>
        </div>

        <div>
          <span className="traffic-dot amber" />
          <strong>Yellow</strong>
          <span>Excess; may proceed</span>
        </div>

        <div>
          <span className="traffic-dot red" />
          <strong>Red</strong>
          <span>Shortage; approval blocked</span>
        </div>
      </section>

      <section className="verification-list">
        {orders.length === 0 ? (
          <section className="panel">
            <EmptyState
              title="Verification queue is clear"
              text="There are no cutting batches waiting for component verification."
            />
          </section>
        ) : (
          orders.map(order => (
            <VerifyCard
              key={order.id}
              order={order}
              refresh={refresh}
              setMessage={setMessage}
            />
          ))
        )}
      </section>
    </div>
  );
}

function VerifyCard({
  order,
  refresh,
  setMessage
}) {
  const [items, setItems] = useState(
    order.items || []
  );

  const [reason, setReason] = useState('');

  const hasRed = items.some(
    item => item.status === 'RED'
  );

  const allCounted =
    items.length > 0 &&
    items.every(
      item =>
        item.actual_qty !== null &&
        item.actual_qty !== undefined
    );

  const canApprove =
    allCounted && !hasRed;

  const countedCount = items.filter(
    item =>
      item.actual_qty !== null &&
      item.actual_qty !== undefined
  ).length;

  async function count(item, value) {
    if (value === '') return;

    if (!/^\d+$/.test(value)) {
      setMessage(
        'Counts must be whole, non-negative numbers.'
      );
      return;
    }

    try {
      const data = await api(
        `/api/orders/${order.id}/counts`,
        {
          method: 'PUT',
          body: JSON.stringify({
            item_id: item.id,
            actual_qty: Number(value)
          })
        }
      );

      setItems(current =>
        current.map(existingItem =>
          existingItem.id === item.id
            ? {
                ...existingItem,
                actual_qty:
                  data.item.actual_qty,
                status: data.item.status
              }
            : existingItem
        )
      );
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function approve() {
    try {
      await api(
        `/api/orders/${order.id}/approve`,
        {
          method: 'POST'
        }
      );

      setMessage(
        'Batch verified and released to the sewing queue.'
      );

      await refresh();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function reject() {
    try {
      await api(
        `/api/orders/${order.id}/reject`,
        {
          method: 'POST',
          body: JSON.stringify({
            reason
          })
        }
      );

      setMessage(
        'Batch rejected and returned to the Cutting Supervisor.'
      );

      await refresh();
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <section className="panel verification-card">
      <div className="batch-header">
        <div>
          <div className="batch-title-line">
            <h2>{order.order_no}</h2>

            <Badge tone="warning">
              Pending verification
            </Badge>
          </div>

          <p>
            {order.recipe_name} · {order.target_qty}{' '}
            garments · {order.fabric_roll_id}
          </p>
        </div>

        <div className="progress-copy">
          <strong>
            {countedCount}/{items.length}
          </strong>

          <span>components counted</span>
        </div>
      </div>

      <div className="count-table">
        <div className="count-table-head">
          <span>Component</span>
          <span>Expected</span>
          <span>Actual</span>
          <span>Status</span>
        </div>

        {items.map(item => (
          <div
            className={`count-row status-${String(
              item.status || 'none'
            ).toLowerCase()}`}
            key={item.id}
          >
            <div className="component-name">
              <strong>
                {item.component_name}
              </strong>
            </div>

            <div className="expected-number">
              {item.expected_qty}
            </div>

            <div>
              <input
                className="count-input"
                aria-label={`Actual count for ${item.component_name}`}
                type="number"
                min="0"
                step="1"
                defaultValue={
                  item.actual_qty ?? ''
                }
                onBlur={event =>
                  count(
                    item,
                    event.target.value
                  )
                }
                placeholder="—"
              />
            </div>

            <div>
              <Badge
                tone={
                  item.status === 'GREEN'
                    ? 'success'
                    : item.status === 'YELLOW'
                    ? 'warning'
                    : item.status === 'RED'
                    ? 'danger'
                    : 'neutral'
                }
              >
                {item.status || 'Uncounted'}
              </Badge>
            </div>
          </div>
        ))}
      </div>

      {hasRed && (
        <div className="hard-stop">
          <Icon name="alert" size={19} />

          <div>
            <strong>Approval blocked</strong>

            <span>
              One or more components are short.
              Reject the batch with a reason so it
              can be re-cut.
            </span>
          </div>
        </div>
      )}

      <div className="verification-actions">
        <label className="field reject-field">
          <span>Rejection reason</span>

          <input
            value={reason}
            onChange={event =>
              setReason(event.target.value)
            }
            placeholder="Required when rejecting a batch"
          />
        </label>

        <div className="button-group">
          <button
            className="btn danger-outline"
            onClick={reject}
          >
            Reject batch
          </button>

          <button
            className="btn primary"
            disabled={!canApprove}
            onClick={approve}
          >
            <Icon name="check" size={16} />
            Approve batch
          </button>
        </div>
      </div>
    </section>
  );
}

function Sewing({
  queue,
  refresh,
  setMessage
}) {
  const totalUnits = queue.reduce(
    (sum, batch) =>
      sum + Number(batch.target_qty || 0),
    0
  );

  const avgWastage = queue.length
    ? queue.reduce(
        (sum, batch) =>
          sum +
          Number(batch.wastage_pct || 0),
        0
      ) / queue.length
    : 0;

  async function start(id) {
    try {
      await api(
        `/api/orders/${id}/start-sewing`,
        {
          method: 'POST'
        }
      );

      setMessage(
        'Sewing assembly started.'
      );

      await refresh();
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <div className="page-content">
      <section className="stat-grid three">
        <StatCard
          label="Ready batches"
          value={queue.length}
          hint="Verified and released"
          icon="check"
        />

        <StatCard
          label="Units queued"
          value={totalUnits}
          hint="Garments ready"
          icon="layers"
        />

        <StatCard
          label="Avg. wastage"
          value={`${avgWastage.toFixed(2)}%`}
          hint="Across ready batches"
          icon="factory"
        />
      </section>

      <section className="queue-list">
        {queue.length === 0 ? (
          <section className="panel">
            <EmptyState
              title="No batches ready for sewing"
              text="Verified batches will appear here automatically after QC approval."
            />
          </section>
        ) : (
          queue.map(batch => (
            <section
              className="panel queue-card"
              key={batch.id}
            >
              <div className="batch-header">
                <div>
                  <div className="batch-title-line">
                    <h2>
                      {batch.order_no}
                    </h2>

                    <Badge tone="success">
                      Verified
                    </Badge>
                  </div>

                  <p>
                    {batch.recipe_name} ·
                    verified by{' '}
                    {batch.verifier_name}
                  </p>
                </div>

                <div className="verification-time">
                  <Icon
                    name="clock"
                    size={15}
                  />

                  <span>
                    {new Date(
                      batch.verification_timestamp
                    ).toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="queue-metrics">
                <div>
                  <span>Target quantity</span>
                  <strong>
                    {batch.target_qty}
                  </strong>
                </div>

                <div>
                  <span>Fabric roll</span>
                  <strong>
                    {batch.fabric_roll_id}
                  </strong>
                </div>

                <div>
                  <span>Fabric wastage</span>
                  <strong>
                    {Number(
                      batch.wastage_pct
                    ).toFixed(2)}
                    %
                  </strong>
                </div>
              </div>

              <details className="audit-details">
                <summary>
                  View component audit
                </summary>

                <pre>
                  {JSON.stringify(
                    batch.component_variances,
                    null,
                    2
                  )}
                </pre>
              </details>

              <div className="queue-footer">
                <span>
                  QC sign-off complete. This
                  batch is cleared for assembly.
                </span>

                <button
                  className="btn primary"
                  onClick={() =>
                    start(batch.id)
                  }
                >
                  Start sewing assembly
                  <Icon
                    name="arrow"
                    size={16}
                  />
                </button>
              </div>
            </section>
          ))
        )}
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  icon
}) {
  return (
    <article className="stat-card">
      <div className="stat-icon">
        <Icon
          name={icon}
          size={18}
        />
      </div>

      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{hint}</small>
      </div>
    </article>
  );
}

function OrderTable({
  orders,
  action
}) {
  return (
    <section className="panel table-panel">
      <div className="panel-header table-title">
        <div>
          <span className="panel-kicker">
            Production history
          </span>

          <h2>Cutting orders</h2>
        </div>

        <span className="record-count">
          {orders.length} records
        </span>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Order</th>
              <th>Recipe</th>
              <th>Quantity</th>
              <th>Fabric roll</th>
              <th>Status</th>
              <th className="align-right">
                Action
              </th>
            </tr>
          </thead>

          <tbody>
            {orders.map(order => (
              <tr key={order.id}>
                <td>
                  <strong>
                    {order.order_no}
                  </strong>
                </td>

                <td>
                  {order.recipe_name}
                </td>

                <td>
                  {order.target_qty}
                </td>

                <td>
                  <span className="mono-lite">
                    {order.fabric_roll_id}
                  </span>
                </td>

                <td>
                  <StatusBadge
                    status={order.status}
                  />
                </td>

                <td className="align-right">
                  {action?.(order)}
                </td>
              </tr>
            ))}

            {orders.length === 0 && (
              <tr>
                <td colSpan="6">
                  <EmptyState
                    title="No cutting orders yet"
                    text="Create your first batch using the form above."
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}