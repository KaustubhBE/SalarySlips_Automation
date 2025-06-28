from Utils.firebase_utils import get_user_base64_token
import json
import base64

if __name__ == "__main__":
    user_id = input("Enter user_id (email): ").strip()
    base64_token = get_user_base64_token(user_id)
    if not base64_token:
        print(f"No BASE64 token found in Firestore for user: {user_id}")
    else:
        try:
            json_content = base64.b64decode(base64_token).decode('utf-8')
            token_data = json.loads(json_content)
            print("Decoded token JSON:")
            print(json.dumps(token_data, indent=2))
        except Exception as e:
            print(f"Error decoding BASE64 token: {e}")
