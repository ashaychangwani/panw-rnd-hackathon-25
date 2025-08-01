import json, os
from datetime import datetime
from assets import extract_assets
from timeline import build_timeline, draw_attack_chain
from mitre_mapping import map_to_mitre
from jinja2 import Template
import matplotlib.pyplot as plt

def iterative_hunt(initial_iocs, search_logs, search_pcap, llm,
                   max_depth=3, report_path="hunt_report.json", html_path="hunt_report.html"):
    seen = set()
    queue = list(initial_iocs)
    all_events = []
    hunt_log = {
        "start_time": datetime.utcnow().isoformat(),
        "initial_iocs": initial_iocs,
        "iterations": []
    }

    for depth in range(max_depth):
        if not queue:
            break
        current_iocs = list(queue)
        queue.clear()

        iteration_data = {
            "round": depth + 1,
            "searched_iocs": current_iocs,
            "events": [],
            "candidate_pivots": [],
            "selected_pivots": []
        }

        iteration_events = []

        # Search logs & PCAPs
        for ioc in current_iocs:
            if ioc in seen:
                continue
            seen.add(ioc)

            log_results = search_logs(ioc)
            iteration_events.extend(log_results["results"])

            if ioc.count('.') == 3:
                pcap_results = search_pcap(f"ip.addr == {ioc}")
            else:
                pcap_results = search_pcap(ioc)
            iteration_events.extend(pcap_results["results"])

        iteration_data["events"] = iteration_events
        all_events.extend(iteration_events)

        # Extract potential pivots
        pivots = extract_assets(iteration_events)
        candidate_pivots = pivots["ips"] + pivots["hosts"] + pivots["users"]
        iteration_data["candidate_pivots"] = candidate_pivots

        if not candidate_pivots:
            hunt_log["iterations"].append(iteration_data)
            break

        # Ask LLM to choose pivots
        prompt = f"""
        We searched for {current_iocs} and found {len(iteration_events)} events.
        Candidate new indicators: {candidate_pivots}.
        Return JSON list of the most relevant indicators to pivot on.
        """
        try:
            llm_response = llm.invoke(prompt)
            next_pivots = json.loads(llm_response)
        except:
            next_pivots = []

        iteration_data["selected_pivots"] = next_pivots
        hunt_log["iterations"].append(iteration_data)

        if not next_pivots:
            break
        queue.extend(next_pivots)

    # Build final results
    timeline = build_timeline(all_events)
    assets = extract_assets(timeline)
    mitre = map_to_mitre(timeline)

    hunt_log["end_time"] = datetime.utcnow().isoformat()
    hunt_log["final_results"] = {
        "timeline": timeline,
        "assets": assets,
        "mitre": mitre
    }

    # Save JSON report
    with open(report_path, "w") as f:
        json.dump(hunt_log, f, indent=2, default=str)

    # Draw attack chain diagram to PNG
    img_path = "attack_chain.png"
    if timeline:
        plt.figure(figsize=(8,6))
        draw_attack_chain(timeline)
        plt.savefig(img_path, bbox_inches="tight")
        plt.close()

    # Generate HTML report
    html_template = Template("""
    <html>
    <head>
        <title>Threat Hunt Report</title>
        <style>
            body { font-family: Arial; padding: 20px; }
            table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
            th, td { border: 1px solid #ccc; padding: 8px; }
            th { background: #eee; }
        </style>
    </head>
    <body>
        <h1>Threat Hunt Report</h1>
        <p><b>Start:</b> {{start_time}} | <b>End:</b> {{end_time}}</p>
        <h2>Initial IOCs</h2>
        <ul>
        {% for ioc in initial_iocs %}
            <li>{{ioc}}</li>
        {% endfor %}
        </ul>

        <h2>Final Affected Assets</h2>
        <pre>{{assets | tojson(indent=2)}}</pre>

        <h2>MITRE ATT&CK Mapping</h2>
        <table>
            <tr><th>Event</th><th>Tactic</th><th>Technique</th></tr>
            {% for m in mitre %}
            <tr><td>{{m.event}}</td><td>{{m.tactic}}</td><td>{{m.technique}}</td></tr>
            {% endfor %}
        </table>

        {% if timeline %}
        <h2>Attack Timeline</h2>
        <table>
            <tr><th>Timestamp</th><th>Event</th></tr>
            {% for ev in timeline %}
            <tr><td>{{ev.timestamp}}</td><td>{{ev.event}}</td></tr>
            {% endfor %}
        </table>
        <img src="{{img_path}}" width="600">
        {% endif %}

        <h2>Iterations</h2>
        {% for it in iterations %}
        <h3>Iteration {{it.round}}</h3>
        <p><b>Searched IOCs:</b> {{it.searched_iocs}}</p>
        <p><b>Candidate Pivots:</b> {{it.candidate_pivots}}</p>
        <p><b>Selected Pivots:</b> {{it.selected_pivots}}</p>
        <details><summary>Events ({{it.events | length}})</summary>
            <pre>{{it.events | tojson(indent=2)}}</pre>
        </details>
        {% endfor %}
    </body>
    </html>
    """)

    html_content = html_template.render(
        start_time=hunt_log["start_time"],
        end_time=hunt_log["end_time"],
        initial_iocs=hunt_log["initial_iocs"],
        assets=assets,
        mitre=mitre,
        timeline=timeline,
        iterations=hunt_log["iterations"],
        img_path=img_path
    )

    with open(html_path, "w") as f:
        f.write(html_content)

    return hunt_log
