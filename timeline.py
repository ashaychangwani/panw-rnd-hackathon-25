from datetime import datetime
import networkx as nx
import matplotlib.pyplot as plt

def build_timeline(events):
    def parse_ts(ts):
        if not ts: return None
        for fmt in ["%Y-%m-%d %H:%M:%S", "%b %d, %Y %H:%M:%S"]:
            try:
                return datetime.strptime(ts.split('.')[0], fmt)
            except:
                continue
        return None

    events_with_time = [e for e in events if e["timestamp"]]
    events_with_time.sort(key=lambda e: parse_ts(e["timestamp"]) or datetime.max)
    return events_with_time

def draw_attack_chain(timeline):
    G = nx.DiGraph()
    for idx, ev in enumerate(timeline):
        label = f"{ev['timestamp']} | {ev['event']}"
        G.add_node(idx, label=label)
        if idx > 0:
            G.add_edge(idx-1, idx)

    pos = nx.spring_layout(G)
    nx.draw(G, pos, node_color="lightgreen", with_labels=False, arrows=True)
    labels = nx.get_node_attributes(G, 'label')
    nx.draw_networkx_labels(G, pos, labels, font_size=7)
    plt.show()
