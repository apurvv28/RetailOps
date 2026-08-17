from backend.agent.service import AgentService


agent = AgentService()


print("0.20 ->", agent.determine_action(0.20))
print("0.50 ->", agent.determine_action(0.50))
print("0.80 ->", agent.determine_action(0.80))