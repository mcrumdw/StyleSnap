import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { EmptyState } from "../components/EmptyState";
import { Input } from "../components/Input";
import { RoleChip } from "../components/RoleChip";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-heading text-section-header font-bold">{title}</h2>
      {children}
    </section>
  );
}

export function KitchenSink() {
  return (
    <main className="mx-auto flex max-w-container flex-col gap-12 px-6 py-12">
      <header>
        <h1 className="font-heading text-page-title font-bold">Kitchen sink</h1>
        <p className="mt-2 text-text-muted">
          Every Phase 0 component, straight from DESIGN.md §5 / §5.1.
        </p>
      </header>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-4">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Button size="sm">Small 36px</Button>
          <Button size="md">Medium 44px</Button>
          <Button size="lg">Large 52px</Button>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Button disabled>Primary disabled</Button>
          <Button variant="secondary" disabled>
            Secondary disabled
          </Button>
          <Button variant="ghost" disabled>
            Ghost disabled
          </Button>
          <Button variant="destructive" disabled>
            Destructive disabled
          </Button>
        </div>
        <p className="text-caption text-text-muted">
          Press and hold any button: it translates 2px/2px and the hard shadow
          collapses.
        </p>
      </Section>

      <Section title="Card">
        <div className="grid max-w-2xl grid-cols-2 gap-6">
          <Card>
            <h3 className="font-heading text-card-title font-medium">Card title</h3>
            <p className="mt-2 text-base text-text-muted">
              Hard offset shadow, 2px border, 14px radius.
            </p>
          </Card>
          <Card selected>
            <h3 className="font-heading text-card-title font-medium">Selected card</h3>
            <p className="mt-2 text-base text-text-muted">
              Border switches to brand-primary when selected.
            </p>
          </Card>
        </div>
      </Section>

      <Section title="Input">
        <div className="flex max-w-md flex-col gap-4">
          <Input label="Token name" placeholder="color/action/primary" />
          <Input
            label="With error"
            defaultValue="not-a-slash-name"
            error="Names are slash-nested, like color/action/primary."
          />
        </div>
      </Section>

      <Section title="Badges">
        <div className="flex flex-wrap items-center gap-4">
          <Badge variant="dup" />
          <Badge variant="sim" />
          <Badge variant="merged" />
        </div>
      </Section>

      <Section title="Role chips">
        <div className="flex flex-wrap items-center gap-4">
          <RoleChip role="color/action/primary" />
          <RoleChip role="color/surface/page" confirmed />
        </div>
        <p className="text-caption text-text-muted">
          Dashed + "?" until confirmed; solid once confirmed.
        </p>
      </Section>

      <Section title="Empty state">
        <Card className="max-w-2xl">
          <EmptyState
            heading="Nothing snapped yet"
            message="Drop a capture to begin."
            action={<Button>Import a capture</Button>}
          />
        </Card>
      </Section>
    </main>
  );
}
