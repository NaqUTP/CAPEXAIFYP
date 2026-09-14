"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { SectionHead, Panel, Empty } from "@/components/ui/primitives";

export default function CompareTab() {
  const [projects, setProjects] = useState<any[]>([]);
  useEffect(() => { api.listProjects().then(setProjects); }, []);

  const withComps = projects.filter((p) => p.components?.length);
  const maxTotal = withComps.length ? Math.max(...withComps.map((p) => p.total)) : 1;

  return (
    <div>
      <SectionHead title="Compare projects" idx="total CAPEX" />
      {!withComps.length ? (
        <Empty>No projects with components yet. Build one in the Project Builder tab.</Empty>
      ) : (
        <>
          <Panel title="Project totals" note={`${withComps.length} projects`}>
            {withComps.map((p) => (
              <div key={p.name} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                  <span>{p.name}</span>
                  <span style={{ fontFamily: "IBM Plex Mono, monospace" }}>{p.total} MM USD</span>
                </div>
                <div style={{ height: 14, background: "#F2F1EC" }}>
                  <div style={{ height: "100%", width: `${(p.total / maxTotal) * 100}%`, background: "var(--deep)" }} />
                </div>
              </div>
            ))}
          </Panel>

          <Panel title="Component breakdown">
            <table>
              <thead><tr><th>Project</th><th>Components</th><th className="num">Total (MM USD)</th></tr></thead>
              <tbody>
                {withComps.map((p) => (
                  <tr key={p.name}>
                    <td>{p.name}</td>
                    <td>{p.components.map((c: any) => c.type).join(", ")}</td>
                    <td className="num">{p.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </>
      )}
    </div>
  );
}
