import time
import sys

def main():
    parents, babies = (1, 1)
    while babies < 100000:
        print 'This generation has {0} babies'.format(babies)
        sys.stdout.flush()
        parents, babies = (babies, parents + babies)
        time.sleep(1)
    

if __name__ == "__main__":
    main()