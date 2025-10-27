import paho.mqtt.client as mqtt

BROKER = "localhost"
TOPICS = [("iot/eldercare/+/motion/#", 0)]

def on_connect(c, userdata, flags, rc):
    print("MQTT connected rc=", rc)
    for t, q in TOPICS:
        c.subscribe(t)
        print("Subscribed:", t)

def on_message(c, userdata, msg):
    print(msg.topic, "=>", msg.payload.decode())

client = mqtt.Client()
client.on_connect = on_connect
client.on_message = on_message
client.connect(BROKER, 1883, 60)
client.loop_forever()

